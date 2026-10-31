import Stripe from "stripe";
import { z } from "zod";
import type { CheckoutAttempt, Invoice } from "@prisma/client";
import { db } from "../db";
import { serializable } from "../core/transaction";
import { AppError } from "../core/errors";
import { requireOwnerOrStaff, type Actor } from "../core/permissions";
import { amount, invoiceBalance, decimal } from "../billing/money";
import { RESERVED_CHECKOUT_STATES } from "./constants";

export interface CheckoutGateway {
  create(data: Stripe.Checkout.SessionCreateParams, options: {idempotencyKey: string}): Promise<Stripe.Checkout.Session>;
  retrieve(id: string): Promise<Stripe.Checkout.Session>;
}
export async function getCheckoutStatus(actor: Actor, invoiceId: string) {
  const invoice = await db.invoice.findUnique({where: {id: invoiceId}, select: {subscription: {select: {customerId: true}}}});
  if (!invoice) throw new AppError("NOT_FOUND", "Resource not found", 404);
  requireOwnerOrStaff(actor, invoice.subscription.customerId);
  const [attempt, exceptions] = await db.$transaction([
    db.checkoutAttempt.findFirst({where: {invoiceId}, orderBy: [{createdAt: "desc"}, {id: "desc"}]}),
    db.checkoutAttempt.count({where: {invoiceId, status: "EXCEPTION"}}),
  ]);
  return {attempt: attempt ? {id: attempt.id, status: attempt.status, url: !exceptions && attempt.status === "OPEN" ? attempt.checkoutUrl : null, expiresAt: attempt.expiresAt} : null, needsReconciliation: exceptions > 0};
}
export function stripeGateway(): CheckoutGateway {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new AppError("GATEWAY_NOT_CONFIGURED", "Configure a Stripe test key", 503);
  const client = new Stripe(key, {maxNetworkRetries: 2, timeout: 15000});
  return {create: (data, options) => client.checkout.sessions.create(data, options), retrieve: id => client.checkout.sessions.retrieve(id)};
}
function minorUnits(value: string) {
  const minor = amount(value).mul(100);
  if (!minor.isInteger() || minor.gt(99999999) || minor.lte(0)) throw new AppError("UNSUPPORTED_AMOUNT", "Use recorded payment for this invoice amount");
  return minor.toNumber();
}
export async function startCheckout(actor: Actor, invoiceId: string, input: unknown, gateway = stripeGateway()) {
  const {idempotencyKey} = z.object({idempotencyKey: z.uuid()}).parse(input);
  const base = process.env.BETTER_AUTH_URL;
  if (!base) throw new AppError("GATEWAY_NOT_CONFIGURED", "Configure the application URL", 503);
  const attempt = await serializable(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({where: {id: invoiceId}, include: {subscription: {select: {customerId: true}}}});
    if (!invoice) throw new AppError("NOT_FOUND", "Resource not found", 404);
    requireOwnerOrStaff(actor, invoice.subscription.customerId);
    const existing = await tx.checkoutAttempt.findUnique({where: {idempotencyKey}});
    if (existing) {
      if (existing.invoiceId !== invoiceId) throw new AppError("IDEMPOTENCY_CONFLICT", "Checkout key is already in use", 409);
      if (await tx.checkoutAttempt.count({where: {invoiceId, status: "EXCEPTION"}})) throw new AppError("RECONCILIATION_REQUIRED", "Review the previous online payment before continuing", 409);
      return existing;
    }
    if (invoice.status !== "CONFIRMED") throw new AppError("INVALID_INVOICE", "Only confirmed unpaid invoices accept checkout", 409);
    if (await tx.checkoutAttempt.count({where: {invoiceId, status: {in: [...RESERVED_CHECKOUT_STATES]}}})) throw new AppError("CHECKOUT_PENDING", "An online payment is already pending", 409);
    const paid = await tx.payment.aggregate({where: {invoiceId}, _sum: {amount: true}});
    const balance = invoiceBalance(invoice.total.toFixed(2), [paid._sum.amount?.toFixed(2) ?? "0"]);
    minorUnits(balance);
    // Stripe requires at least 30 minutes; leave room for request latency.
    const expiresAt = new Date(Date.now() + 31 * 60 * 1000);
    return tx.checkoutAttempt.create({data: {invoiceId, createdBy: actor.id, idempotencyKey, amount: balance, currency: invoice.currency, expiresAt, nextReconcileAt: expiresAt}});
  });
  if (attempt.status !== "RESERVING") return attempt;
  return finishCreation(attempt, await db.invoice.findUniqueOrThrow({where: {id: invoiceId}}), gateway);
}
async function finishCreation(attempt: CheckoutAttempt, invoice: Invoice, gateway: CheckoutGateway) {
  if (Date.now() - attempt.createdAt.getTime() > 23 * 60 * 60 * 1000) {
    return db.checkoutAttempt.update({where: {id: attempt.id}, data: {status: "EXCEPTION", failureCode: "RECOVERY_WINDOW_EXPIRED"}});
  }
  try {
    const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
    const session = await gateway.create({
      mode: "payment", allowed_payment_method_types: ["card"], adaptive_pricing: {enabled: false}, automatic_tax: {enabled: false}, allow_promotion_codes: false, customer_email: invoice.customerEmail,
      client_reference_id: attempt.id, metadata: {attemptId: attempt.id, invoiceId: invoice.id},
      payment_intent_data: {metadata: {attemptId: attempt.id, invoiceId: invoice.id}},
      line_items: [{quantity: 1, price_data: {currency: attempt.currency.toLowerCase(), unit_amount: minorUnits(attempt.amount.toFixed(2)), product_data: {name: `Invoice ${invoice.number}`}}}],
      success_url: `${origin}/portal/invoices/${invoice.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portal/invoices/${invoice.id}?checkout=cancelled`,
      expires_at: Math.floor(attempt.expiresAt.getTime() / 1000),
    }, {idempotencyKey: `checkout:${attempt.id}`});
    await db.checkoutAttempt.updateMany({where: {id: attempt.id, status: "RESERVING"}, data: {status: "OPEN", providerSessionId: session.id, checkoutUrl: session.url, failureCode: null, nextReconcileAt: new Date(session.expires_at * 1000)}});
    if (session.payment_status === "paid" || session.status === "expired") await processSession(`recovery:${session.id}:${session.payment_status}:${session.status}`, session.status === "expired" ? "checkout.session.expired" : "checkout.session.completed", session, new Date());
    return db.checkoutAttempt.findUniqueOrThrow({where: {id: attempt.id}});
  } catch (error) {
    const definitive = error instanceof Stripe.errors.StripeInvalidRequestError || error instanceof Stripe.errors.StripeAuthenticationError;
    await db.checkoutAttempt.updateMany({where: {id: attempt.id, status: "RESERVING"}, data: {status: definitive ? "FAILED" : "RESERVING", failureCode: definitive ? "GATEWAY_REJECTED" : "GATEWAY_UNAVAILABLE", nextReconcileAt: new Date(Date.now() + 60000)}});
    throw new AppError("GATEWAY_UNAVAILABLE", "Online checkout is unavailable; retry this request with the same key", 503);
  }
}
export function verifyStripeEvent(payload: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new AppError("GATEWAY_NOT_CONFIGURED", "Configure the webhook signing secret", 503);
  try { return new Stripe("sk_test_signature_verification").webhooks.constructEvent(payload, signature, secret); }
  catch { throw new AppError("INVALID_SIGNATURE", "Invalid payment signature", 400); }
}
export async function handleStripeEvent(event: Stripe.Event) {
  if (event.livemode) throw new AppError("LIVE_MODE_DISABLED", "This application is configured for test payments", 400);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) return {ignored: true};
  return processSession(event.id, event.type, event.data.object as Stripe.Checkout.Session, new Date(event.created * 1000));
}
async function processSession(eventId: string, type: string, session: Stripe.Checkout.Session, paidAt: Date) {
  const attemptId = session.metadata?.attemptId;
  if (!attemptId) return {ignored: true};
  return serializable(async tx => {
    const attempt = await tx.checkoutAttempt.findUnique({where: {id: attemptId}});
    if (!attempt) return {ignored: true};
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${attempt.invoiceId} FOR UPDATE`;
    if (await tx.providerEvent.findUnique({where: {id: eventId}})) return {duplicate: true};
    const current = await tx.checkoutAttempt.findUniqueOrThrow({where: {id: attemptId}});
    let outcome = "PENDING";
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (current.status === "PAID" && (session.payment_status !== "paid" || (current.providerSessionId === session.id && current.providerPaymentId === paymentId))) outcome = "IGNORED";
    else if (session.payment_status === "paid") {
      const invoice = await tx.invoice.findUniqueOrThrow({where: {id: current.invoiceId}});
      const paid = await tx.payment.aggregate({where: {invoiceId: invoice.id}, _sum: {amount: true}});
      const balance = invoiceBalance(invoice.total.toFixed(2), [paid._sum.amount?.toFixed(2) ?? "0"]);
      const received = Number.isSafeInteger(session.amount_total) && session.amount_total! >= 0 ? decimal(String(session.amount_total)).div(100) : null;
      const receiptId = paymentId ? `stripe:${paymentId}` : `session:${session.id}`;
      const receipt = await tx.providerReceipt.findUnique({where: {id: receiptId}});
      const matches = (!receipt || receipt.attemptId === current.id) && !session.livemode && session.mode === "payment" && session.status === "complete" && session.client_reference_id === current.id && session.metadata?.invoiceId === invoice.id && (!current.providerSessionId || current.providerSessionId === session.id) && received?.eq(current.amount.toFixed(2)) && amount(balance).eq(current.amount.toFixed(2)) && session.currency?.toUpperCase() === current.currency && invoice.currency === current.currency && invoice.status === "CONFIRMED" && !!paymentId && current.status !== "EXCEPTION";
      if (!matches) {
        outcome = "EXCEPTION";
        await tx.checkoutAttempt.update({where: {id: current.id}, data: {status: "EXCEPTION", failureCode: "PAYMENT_RECONCILIATION_REQUIRED", receivedAmount: received?.toFixed(2), receivedCurrency: session.currency, providerPaymentId: current.providerPaymentId ?? paymentId}});
      } else {
        await tx.payment.create({data: {invoiceId: invoice.id, amount: current.amount, method: "STRIPE", paidAt, reference: `stripe:${paymentId}`, externalReference: paymentId, recordedBy: "stripe-webhook"}});
        await tx.invoice.update({where: {id: invoice.id}, data: {status: "PAID"}});
        await tx.checkoutAttempt.update({where: {id: current.id}, data: {status: "PAID", providerSessionId: session.id, providerPaymentId: paymentId, receivedAmount: received!.toFixed(2), receivedCurrency: session.currency, failureCode: null}});
        await tx.auditEvent.create({data: {actorId: "stripe-webhook", action: "payment.received", resourceId: invoice.id}});
        outcome = "PAID";
      }
      await tx.providerReceipt.upsert({where: {id: receiptId}, create: {id: receiptId, attemptId: current.id, providerSessionId: session.id, amount: received?.toFixed(2), currency: session.currency, outcome}, update: {}});
    } else if (current.status !== "EXCEPTION" && (type === "checkout.session.expired" || type === "checkout.session.async_payment_failed")) {
      // Verify linkage even for events that release a reservation.
      if (session.client_reference_id === current.id && session.metadata?.invoiceId === current.invoiceId && (!current.providerSessionId || current.providerSessionId === session.id) && (type !== "checkout.session.expired" || session.status === "expired")) {
        const terminal = type === "checkout.session.expired" ? "EXPIRED" as const : "FAILED" as const;
        outcome = terminal;
        await tx.checkoutAttempt.update({where: {id: current.id}, data: {status: terminal, providerSessionId: session.id}});
      }
    }
    await tx.providerEvent.create({data: {id: eventId, type, attemptId, outcome}});
    return {outcome};
  });
}
export async function reconcileCheckouts(gateway = stripeGateway(), now = new Date()) {
  const attempts = await db.checkoutAttempt.findMany({where: {status: {in: ["RESERVING", "OPEN"]}, nextReconcileAt: {lte: now}}, take: 20, orderBy: {nextReconcileAt: "asc"}});
  for (const attempt of attempts) {
    try {
      if (!attempt.providerSessionId) await finishCreation(attempt, await db.invoice.findUniqueOrThrow({where: {id: attempt.invoiceId}}), gateway);
      else {
        const session = await gateway.retrieve(attempt.providerSessionId);
        if (session.livemode) throw new Error("Unexpected live session");
        await processSession(`reconcile:${session.id}:${session.payment_status}:${session.status}`, session.status === "expired" ? "checkout.session.expired" : "checkout.session.completed", session, now);
        await db.checkoutAttempt.updateMany({where: {id: attempt.id, status: "OPEN"}, data: {nextReconcileAt: new Date(now.getTime() + 60000)}});
      }
    } catch { await db.checkoutAttempt.updateMany({where: {id: attempt.id, status: {in: ["RESERVING", "OPEN"]}}, data: {failureCode: "RECONCILIATION_UNAVAILABLE", nextReconcileAt: new Date(now.getTime() + 60000)}}); }
  }
  return attempts.length;
}
