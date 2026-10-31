import type { Actor } from "../core/permissions";
import { requireOwnerOrStaff, requirePermission } from "../core/permissions";
import { AppError } from "../core/errors";
import { db } from "../db";
import { serializable } from "../core/transaction";
import { invoiceBalance } from "../billing/money";
import { paginationSchema } from "../core/contracts";
import { z } from "zod";
import { RESERVED_CHECKOUT_STATES } from "../payments/constants";

export async function listInvoices(actor: Actor, input: unknown) {
  const {page, pageSize, status} = paginationSchema.extend({status: z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]).optional()}).parse(input);
  const where = {...(actor.role === "CUSTOMER" ? {subscription: {customerId: actor.id}} : {}), ...(status ? {status} : {})};
  const [invoices, total] = await db.$transaction([
    db.invoice.findMany({where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{createdAt: "desc"}, {id: "desc"}], select: {id: true, number: true, subscriptionId: true, status: true, currency: true, total: true, dueAt: true, createdAt: true, customerName: true, customerEmail: true}}),
    db.invoice.count({where}),
  ]);
  const sums = await db.payment.groupBy({by: ["invoiceId"], where: {invoiceId: {in: invoices.map(row => row.id)}}, _sum: {amount: true}});
  const paid = new Map(sums.map(row => [row.invoiceId, row._sum.amount?.toFixed(2) ?? "0"]));
  return {data: invoices.map(invoice => ({...invoice, balance: invoice.status === "CANCELLED" ? "0.00" : invoiceBalance(invoice.total.toFixed(2), [paid.get(invoice.id) ?? "0"])})), pagination: {page, pageSize, total}};
}

export async function getInvoice(actor: Actor, id: string) {
  const invoice = await db.invoice.findUnique({where: {id}, include: {lines: true, subscription: {select: {customerId: true}}}});
  if (!invoice) throw new AppError("NOT_FOUND", "Resource not found", 404);
  requireOwnerOrStaff(actor, invoice.subscription.customerId);
  const payments = await db.payment.aggregate({where: {invoiceId: id}, _sum: {amount: true}});
  const balance = invoice.status === "CANCELLED" ? "0.00" : invoiceBalance(invoice.total.toFixed(2), [payments._sum.amount?.toFixed(2) ?? "0"]);
  return {...invoice, balance, overdue: invoice.status === "CONFIRMED" && balance !== "0.00" && invoice.dueAt < new Date()};
}
export async function actOnInvoice(actor: Actor, id: string, action: "CONFIRM" | "CANCEL") {
  requirePermission(actor, "business:write");
  return serializable(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({where: {id}});
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    if (action === "CANCEL") {
      if (invoice.status === "CANCELLED") return invoice;
      if (await tx.checkoutAttempt.count({where: {invoiceId: id, status: {in: [...RESERVED_CHECKOUT_STATES]}}})) throw new AppError("CHECKOUT_PENDING", "Reconcile online checkout before cancelling", 409);
      if (invoice.status === "PAID" || await tx.payment.count({where: {invoiceId: id}})) throw new AppError("PAYMENTS_EXIST", "Paid invoices cannot be cancelled", 409);
    } else {
      if (invoice.status === "CONFIRMED" || invoice.status === "PAID") return invoice;
      if (invoice.status !== "DRAFT") throw new AppError("INVALID_TRANSITION", "Invoice cannot be confirmed", 409);
    }
    const result = await tx.invoice.update({where: {id}, data: {status: action === "CANCEL" ? "CANCELLED" : invoice.total.isZero() ? "PAID" : "CONFIRMED"}});
    if(action==="CANCEL"){
      const use=await tx.discountUse.findUnique({where:{invoiceId:id}});
      if(use && !use.restoredAt){
        await tx.discountRule.update({where:{id:use.discountId},data:{usageCount:{decrement:1}}});
        await tx.discountUse.update({where:{id:use.id},data:{restoredAt:new Date()}});
      }
    }
    await tx.auditEvent.create({data: {actorId: actor.id, action: `invoice.${action.toLowerCase()}`, resourceId: id}});
    return result;
  });
}
