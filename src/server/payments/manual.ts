import { z } from "zod";
import { moneySchema } from "../core/contracts";
import { AppError } from "../core/errors";
import { requirePermission, type Actor } from "../core/permissions";
import { serializable } from "../core/transaction";
import { amount, invoiceBalance } from "../billing/money";
import { RESERVED_CHECKOUT_STATES } from "./constants";

export const manualPaymentSchema = z.object({
  idempotencyKey: z.uuid(), amount: moneySchema.refine(value => Number(value) > 0, "Payment must be positive"),
  method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "OTHER"]),
  paidAt: z.iso.datetime().transform(value => new Date(value)).optional(),
  note: z.string().trim().max(2000).optional(), externalReference: z.string().trim().max(200).optional(),
});
export async function recordManualPayment(actor: Actor, invoiceId: string, input: unknown, now = new Date()) {
  requirePermission(actor, "business:write");
  const data = manualPaymentSchema.parse(input);
  return serializable(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const existing = await tx.payment.findUnique({where: {reference: `manual:${data.idempotencyKey}`}});
    if (existing) {
      if (existing.invoiceId !== invoiceId || !existing.amount.eq(data.amount) || existing.method !== data.method || (existing.note ?? "") !== (data.note ?? "") || (existing.externalReference ?? "") !== (data.externalReference ?? "") || (data.paidAt && existing.paidAt.getTime() !== data.paidAt.getTime())) throw new AppError("IDEMPOTENCY_CONFLICT", "This payment key was used for another request", 409);
      return existing;
    }
    const invoice = await tx.invoice.findUnique({where: {id: invoiceId}});
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    if (invoice.status !== "CONFIRMED") throw new AppError("INVALID_INVOICE", "Only confirmed unpaid invoices accept payments", 409);
    if (await tx.checkoutAttempt.count({where: {invoiceId, status: {in: [...RESERVED_CHECKOUT_STATES]}}})) throw new AppError("CHECKOUT_PENDING", "Reconcile the online payment before recording another payment", 409);
    const paid = await tx.payment.aggregate({where: {invoiceId}, _sum: {amount: true}});
    const balance = invoiceBalance(invoice.total.toFixed(2), [paid._sum.amount?.toFixed(2) ?? "0"]);
    if (amount(data.amount).gt(balance)) throw new AppError("OVERPAYMENT", "Payment exceeds the outstanding balance", 409);
    const payment = await tx.payment.create({data: {invoiceId, amount: data.amount, method: data.method, paidAt: data.paidAt ?? now, note: data.note, externalReference: data.externalReference, reference: `manual:${data.idempotencyKey}`, recordedBy: actor.id}});
    if (amount(data.amount).eq(balance)) await tx.invoice.update({where: {id: invoiceId}, data: {status: "PAID"}});
    await tx.auditEvent.create({data: {actorId: actor.id, action: "payment.recorded", resourceId: payment.id}});
    return payment;
  });
}
