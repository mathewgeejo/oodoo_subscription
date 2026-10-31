import { randomUUID } from "node:crypto";
import { serializable } from "../core/transaction";
import { AppError } from "../core/errors";
import { calculateInvoice } from "./money";
import { periodBoundary } from "./calendar";

/** One due period per transaction. Row locking + a unique period key make both
 * concurrent invocations and process-crash retries safe. No external I/O here. */
export async function billSubscription(id: string, now = new Date(), actorId = "billing-worker") {
  return serializable(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "id" = ${id} FOR UPDATE`;
    const subscription = await tx.subscription.findUnique({where: {id}, include: {lines: true, customer: true}});
    if (!subscription) throw new AppError("NOT_FOUND", "Subscription not found", 404);
    if (subscription.status !== "ACTIVE") return null;
    if (subscription.pendingActionAt && subscription.pendingActionAt <= now) {
      const status = subscription.pendingAction === "PAUSE" ? "PAUSED" : "CLOSED";
      await tx.subscription.update({where: {id}, data: {status, pendingAction: null, pendingActionAt: null, nextBillingAt: null, version: {increment: 1}}});
      await tx.auditEvent.create({data: {actorId, action: `subscription.${status.toLowerCase()}`, resourceId: id}});
      return null;
    }
    const index = subscription.nextPeriodIndex;
    const start = periodBoundary(subscription.startAt, subscription.cadence, index, subscription.billingTimezone);
    if (start >= subscription.expiresAt) {
      await tx.subscription.update({where: {id}, data: {nextBillingAt: null, ...(subscription.autoClose && now >= subscription.expiresAt ? {status: "CLOSED"} : {}), version: {increment: 1}}});
      return null;
    }
    if (start > now) return null;
    const next = periodBoundary(subscription.startAt, subscription.cadence, index + 1, subscription.billingTimezone);
    const end = next > subscription.expiresAt ? subscription.expiresAt : next;
    const amounts = calculateInvoice([
      {description: subscription.planName, quantity: 1, unitPrice: subscription.basePrice.toFixed(2), taxPercent: subscription.baseTaxPercent.toFixed(2)},
      ...subscription.lines.map(line => ({description: line.description, quantity: line.quantity, unitPrice: line.unitPrice.toFixed(2), taxPercent: line.taxPercent.toFixed(2)})),
    ]);
    const existing = await tx.invoice.findUnique({where: {subscriptionId_periodIndex: {subscriptionId: id, periodIndex: index}}});
    const invoice = existing ?? await tx.invoice.create({data: {
      number: `INV-${randomUUID()}`, subscriptionId: id, periodIndex: index, periodStart: start, periodEnd: end,
      dueAt: periodBoundary(start, "DAILY", subscription.paymentTermDays, subscription.billingTimezone),
      status: amounts.total === "0.00" ? "PAID" : "CONFIRMED", currency: subscription.currency,
      customerName: subscription.customer.name, customerEmail: subscription.customer.email,
      subtotal: amounts.subtotal, discount: amounts.discount, tax: amounts.tax, total: amounts.total,
      lines: {create: amounts.lines},
    }});
    await tx.subscription.update({where: {id}, data: {nextPeriodIndex: index + 1, nextBillingAt: end, billingFailureCount: 0, billingRetryAt: null, billingLastError: null, version: {increment: 1}}});
    if (!existing) await tx.auditEvent.create({data: {actorId, action: "invoice.generated", resourceId: invoice.id}});
    return invoice;
  });
}
