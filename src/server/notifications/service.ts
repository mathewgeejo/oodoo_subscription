import nodemailer from "nodemailer";
import { db } from "../db";
import { serializable } from "../core/transaction";
import { requirePermission, type Actor } from "../core/permissions";
import { AppError } from "../core/errors";
export async function queueInvoice(actor: Actor, invoiceId: string) {
  requirePermission(actor, "business:write");
  return serializable(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    if (!["CONFIRMED", "PAID"].includes(invoice.status))
      throw new AppError(
        "INVALID_INVOICE",
        "Issue the invoice before sending it",
        409,
      );
    const job = await tx.notificationJob.upsert({
      where: { idempotencyKey: `invoice:${invoiceId}` },
      create: {
        invoiceId,
        kind: "INVOICE",
        idempotencyKey: `invoice:${invoiceId}`,
      },
      update: {},
    });
    if (job.status === "FAILED")
      return tx.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
        },
      });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "invoice.delivery_requested",
        resourceId: invoiceId,
      },
    });
    return job;
  });
}
type Message = { to: string; subject: string; text: string; messageId: string };
async function smtpSend(message: Message) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    throw new Error("SMTP_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transporter.sendMail({ ...message, from: process.env.SMTP_FROM });
}
export async function runNotificationBatch(
  now = new Date(),
  limit = 20,
  send: (message: Message) => Promise<unknown> = smtpSend,
) {
  const candidates = await db.notificationJob.findMany({
    where: {
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "SENDING", leaseUntil: { lte: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const candidate of candidates) {
    const leaseUntil = new Date(now.getTime() + 120000);
    const claimed = await db.notificationJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        attempts: candidate.attempts,
        ...(candidate.status === "SENDING"
          ? { leaseUntil: { lte: now } }
          : { nextAttemptAt: { lte: now } }),
      },
      data: { status: "SENDING", leaseUntil, attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    const fence = {
      id: candidate.id,
      status: "SENDING" as const,
      attempts: candidate.attempts + 1,
      leaseUntil,
    };
    try {
      const invoice = await db.invoice.findUniqueOrThrow({
        where: { id: candidate.invoiceId },
      });
      if (
        !["CONFIRMED", "PAID"].includes(invoice.status) ||
        /\.(example|test|invalid)$/i.test(invoice.customerEmail)
      ) {
        await db.notificationJob.updateMany({
          where: fence,
          data: {
            status: "SKIPPED",
            leaseUntil: null,
            lastError:
              invoice.status === "CANCELLED"
                ? "INVOICE_CANCELLED"
                : "DEMO_OR_UNISSUED_INVOICE",
          },
        });
        skipped++;
        continue;
      }
      const base = process.env.BETTER_AUTH_URL;
      if (!base) throw new Error("APP_URL_NOT_CONFIGURED");
      await send({
        to: invoice.customerEmail,
        subject: `Your Brightloop invoice ${invoice.number}`,
        text: `Hello ${invoice.customerName},\n\nInvoice ${invoice.number}: ${invoice.currency} ${invoice.total.toFixed(2)}. Due ${invoice.dueAt.toISOString().slice(0, 10)}.\nView the current balance, print or pay securely: ${new URL(`/portal/invoices/${invoice.id}`, base).href}\n\nThank you,\nBrightloop`,
        messageId: `<invoice-${candidate.id}@${new URL(base).hostname}>`,
      });
      await db.notificationJob.updateMany({
        where: fence,
        data: {
          status: "SENT",
          sentAt: new Date(),
          leaseUntil: null,
          lastError: null,
        },
      });
      sent++;
    } catch (error) {
      const code =
        error instanceof Error &&
        ["SMTP_NOT_CONFIGURED", "APP_URL_NOT_CONFIGURED"].includes(
          error.message,
        )
          ? error.message
          : "DELIVERY_FAILED";
      await db.notificationJob.updateMany({
        where: fence,
        data: {
          status: candidate.attempts >= 4 ? "FAILED" : "PENDING",
          leaseUntil: null,
          nextAttemptAt: new Date(
            now.getTime() + Math.min(3600000, 30000 * 2 ** candidate.attempts),
          ),
          lastError: code,
        },
      });
      failed++;
    }
  }
  return { sent, failed, skipped };
}
