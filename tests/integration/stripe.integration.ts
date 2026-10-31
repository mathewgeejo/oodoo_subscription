import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import Stripe from "stripe";
import { db } from "../../src/server/db";
import { createDraft, actOnSubscription } from "../../src/server/subscriptions/service";
import { billSubscription } from "../../src/server/billing/service";
import { recordManualPayment } from "../../src/server/payments/manual";
import { actOnInvoice } from "../../src/server/invoices/service";
import { startCheckout, getCheckoutStatus, reconcileCheckouts, type CheckoutGateway } from "../../src/server/payments/stripe";
import { POST as webhook } from "../../src/app/api/webhooks/stripe/route";
import type { Actor } from "../../src/server/core/permissions";
if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Use matching URLs for a dedicated *_test database");
let admin: Actor;
let customer: Actor;
before(async () => {
  const id = randomUUID();
  const user = await db.user.findFirst({where: {role: "ADMIN"}}) ?? await db.user.create({data: {id, name: "Test admin", email: `${id}@example.test`, role: "ADMIN"}});
  admin = {id: user.id, role: "ADMIN"};
  const customerId = randomUUID();
  await db.user.create({data: {id: customerId, name: "Gateway test", email: `${customerId}@example.test`}});
  customer = {id: customerId, role: "CUSTOMER"};
  process.env.BETTER_AUTH_URL = "http://localhost:3100";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_" + randomBytes(32).toString("hex");
});
after(() => db.$disconnect());
async function invoice() {
  const start = new Date("2026-01-01T00:00:00Z");
  const draft = await createDraft(admin, {customerId: customer.id, planName: "Gateway test", cadence: "MONTHLY", basePrice: "100", baseTaxPercent: "18", startAt: start.toISOString(), expiresAt: "2027-01-01T00:00:00Z", lines: [{description: "Seats", quantity: 2, unitPrice: "10", taxPercent: "18"}]});
  for (const action of ["QUOTE", "CONFIRM", "ACTIVATE"] as const) await actOnSubscription(admin, draft.id, action, start);
  return (await billSubscription(draft.id, start))!;
}
class FakeGateway implements CheckoutGateway {
  sessions = new Map<string, Stripe.Checkout.Session>();
  failNext = false;
  async create(data: Stripe.Checkout.SessionCreateParams, options: {idempotencyKey: string}) {
    let session = this.sessions.get(options.idempotencyKey);
    if (!session) {
      session = {id: `cs_test_${randomUUID()}`, object: "checkout.session", livemode: false, mode: "payment", url: "https://checkout.stripe.com/c/pay/test", expires_at: data.expires_at!, status: "open", payment_status: "unpaid", amount_total: data.line_items![0].price_data!.unit_amount, currency: data.line_items![0].price_data!.currency, metadata: data.metadata, client_reference_id: data.client_reference_id, payment_intent: null} as Stripe.Checkout.Session;
      this.sessions.set(options.idempotencyKey, session);
    }
    if (this.failNext) {this.failNext = false; throw new Error("Provider response lost after creation");}
    return session;
  }
  async retrieve(id: string) {
    const session = [...this.sessions.values()].find(value => value.id === id);
    if (!session) throw new Error("Unknown test session");
    return session;
  }
}
function paid(session: Stripe.Checkout.Session) {
  session.status = "complete";
  session.payment_status = "paid";
  session.payment_intent = `pi_test_${randomUUID()}`;
  return session;
}
function eventRequest(session: Stripe.Checkout.Session, type = "checkout.session.completed", id = `evt_${randomUUID()}`) {
  const payload = JSON.stringify({id, object: "event", livemode: false, created: Math.floor(Date.now() / 1000), type, data: {object: session}});
  const signature = new Stripe("sk_test_signing").webhooks.generateTestHeaderString({payload, secret: process.env.STRIPE_WEBHOOK_SECRET!});
  return new Request("http://localhost:3100/api/webhooks/stripe", {method: "POST", headers: {"stripe-signature": signature}, body: payload});
}
test("webhook rejects missing/invalid signatures and oversized raw bodies", async () => {
  assert.equal((await webhook(new Request("http://localhost/webhook", {method: "POST", body: "{}"}))).status, 400);
  assert.equal((await webhook(new Request("http://localhost/webhook", {method: "POST", headers: {"stripe-signature": "invalid"}, body: "{}"}))).status, 400);
  assert.equal((await webhook(new Request("http://localhost/webhook", {method: "POST", headers: {"stripe-signature": "invalid"}, body: "x".repeat(1000001)}))).status, 413);
});
test("checkout reserves the server balance, retries idempotently, and blocks conflicting writes", async () => {
  const inv = await invoice();
  const gateway = new FakeGateway();
  const input = {idempotencyKey: randomUUID()};
  const attempt = await startCheckout(customer, inv.id, input, gateway);
  assert.equal(attempt.status, "OPEN");
  assert.equal([...gateway.sessions.values()][0].amount_total, 14160);
  assert.equal((await startCheckout(customer, inv.id, input, gateway)).id, attempt.id);
  assert.equal(gateway.sessions.size, 1);
  assert.equal((await getCheckoutStatus(customer, inv.id)).attempt?.status, "OPEN");
  await assert.rejects(() => getCheckoutStatus({id: "other-customer", role: "CUSTOMER"}, inv.id));
  await assert.rejects(() => startCheckout(customer, inv.id, {idempotencyKey: randomUUID()}, gateway));
  await assert.rejects(() => startCheckout({id: "other-customer", role: "CUSTOMER"}, inv.id, input, gateway));
  await assert.rejects(() => recordManualPayment(admin, inv.id, {idempotencyKey: randomUUID(), amount: "1", method: "CASH"}));
  await assert.rejects(() => actOnInvoice(admin, inv.id, "CANCEL"));
});
test("signed successful webhooks create one payment across duplicate and separate provider events", async () => {
  const inv = await invoice();
  const gateway = new FakeGateway();
  await startCheckout(customer, inv.id, {idempotencyKey: randomUUID()}, gateway);
  const session = paid([...gateway.sessions.values()][0]);
  const eventId = `evt_${randomUUID()}`;
  assert.equal((await webhook(eventRequest(session, "checkout.session.completed", eventId))).status, 200);
  assert.equal((await webhook(eventRequest(session, "checkout.session.completed", eventId))).status, 200);
  assert.equal((await webhook(eventRequest(session))).status, 200);
  assert.equal(await db.payment.count({where: {invoiceId: inv.id}}), 1);
  assert.equal((await db.invoice.findUniqueOrThrow({where: {id: inv.id}})).status, "PAID");
  session.status = "expired";
  session.payment_status = "unpaid";
  await webhook(eventRequest(session, "checkout.session.expired"));
  assert.equal((await db.checkoutAttempt.findFirstOrThrow({where: {invoiceId: inv.id}})).status, "PAID");
  session.status = "complete";
  session.payment_status = "paid";
  session.payment_intent = `pi_extra_${randomUUID()}`;
  await webhook(eventRequest(session));
  assert.equal(await db.providerReceipt.count({where: {attempt: {invoiceId: inv.id}}}), 2);
  assert.equal(await db.payment.count({where: {invoiceId: inv.id}}), 1);
  assert.equal((await db.checkoutAttempt.findFirstOrThrow({where: {invoiceId: inv.id}})).status, "EXCEPTION");
});
test("amount and currency mismatches become visible reconciliation exceptions without payments", async () => {
  for (const mismatch of ["amount", "currency"]) {
    const inv = await invoice();
    const gateway = new FakeGateway();
    await startCheckout(customer, inv.id, {idempotencyKey: randomUUID()}, gateway);
    const session = paid([...gateway.sessions.values()][0]);
    if (mismatch === "amount") session.amount_total! += 1;
    else session.currency = "usd";
    assert.equal((await webhook(eventRequest(session))).status, 200);
    assert.equal((await db.checkoutAttempt.findFirstOrThrow({where: {invoiceId: inv.id}})).status, "EXCEPTION");
    assert.equal(await db.payment.count({where: {invoiceId: inv.id}}), 0);
    assert.equal((await getCheckoutStatus(customer, inv.id)).needsReconciliation, true);
    assert.equal((await getCheckoutStatus(customer, inv.id)).attempt?.url, null);
    await assert.rejects(() => recordManualPayment(admin, inv.id, {idempotencyKey: randomUUID(), amount: "1", method: "CASH"}));
  }
});
test("unpaid redirects do not mark paid; provider expiry releases holds and late receipts are preserved", async () => {
  const inv = await invoice();
  const gateway = new FakeGateway();
  await startCheckout(customer, inv.id, {idempotencyKey: randomUUID()}, gateway);
  const session = [...gateway.sessions.values()][0];
  session.status = "complete";
  await webhook(eventRequest(session));
  assert.equal((await db.invoice.findUniqueOrThrow({where: {id: inv.id}})).status, "CONFIRMED");
  session.status = "expired";
  await webhook(eventRequest(session, "checkout.session.expired"));
  await recordManualPayment(admin, inv.id, {idempotencyKey: randomUUID(), amount: "141.60", method: "BANK_TRANSFER"});
  await webhook(eventRequest(paid(session)));
  const attempt = await db.checkoutAttempt.findFirstOrThrow({where: {invoiceId: inv.id}});
  assert.equal(attempt.status, "EXCEPTION");
  assert.equal(attempt.receivedAmount?.toFixed(2), "141.60");
  assert.equal(await db.payment.count({where: {invoiceId: inv.id}}), 1);
});
test("lost create responses recover with one provider session and reconcile missed paid events", async () => {
  const inv = await invoice();
  const gateway = new FakeGateway();
  gateway.failNext = true;
  const input = {idempotencyKey: randomUUID()};
  await assert.rejects(() => startCheckout(customer, inv.id, input, gateway));
  const attempt = await db.checkoutAttempt.findUniqueOrThrow({where: {idempotencyKey: input.idempotencyKey}});
  assert.equal(attempt.status, "RESERVING");
  await db.checkoutAttempt.update({where: {id: attempt.id}, data: {nextReconcileAt: new Date(0)}});
  await reconcileCheckouts(gateway);
  assert.equal(gateway.sessions.size, 1);
  assert.equal((await db.checkoutAttempt.findUniqueOrThrow({where: {id: attempt.id}})).status, "OPEN");
  paid([...gateway.sessions.values()][0]);
  await db.checkoutAttempt.update({where: {id: attempt.id}, data: {nextReconcileAt: new Date(0)}});
  await reconcileCheckouts(gateway);
  assert.equal((await db.invoice.findUniqueOrThrow({where: {id: inv.id}})).status, "PAID");
});
test("simultaneous recorded payment and online checkout cannot both reserve the balance", async () => {
  const inv = await invoice();
  const gateway = new FakeGateway();
  const results = await Promise.allSettled([
    startCheckout(customer, inv.id, {idempotencyKey: randomUUID()}, gateway),
    recordManualPayment(admin, inv.id, {idempotencyKey: randomUUID(), amount: "141.60", method: "CASH"}),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(await db.payment.count({where: {invoiceId: inv.id}}) + await db.checkoutAttempt.count({where: {invoiceId: inv.id, status: "OPEN"}}), 1);
});
