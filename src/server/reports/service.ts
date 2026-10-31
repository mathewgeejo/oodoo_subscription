import { z } from "zod";
import { db } from "../db";
import { requirePermission, type Actor } from "../core/permissions";
const rangeSchema = z
  .object({
    from: z.iso.datetime().transform((value) => new Date(value)),
    to: z.iso.datetime().transform((value) => new Date(value)),
  })
  .refine(
    (value) =>
      value.to > value.from &&
      value.to.getTime() - value.from.getTime() <= 366 * 86400000,
    { message: "Choose a date range up to 366 days" },
  );
export async function businessReport(actor: Actor, input: unknown) {
  requirePermission(actor, "reports:read");
  const { from, to } = rangeSchema.parse(input);
  const now = new Date();
  // Source totals are aggregated in PostgreSQL. Money remains decimal text.
  return db.$transaction(
    async (tx) => {
      const [totals] = await tx.$queryRaw<
        {
          billed: string;
          collected: string;
          outstanding: string;
          overdue: string;
          invoiceCount: number;
        }[]
      >`
     WITH paid AS (SELECT "invoiceId",SUM("amount") AS amount FROM "Payment" GROUP BY "invoiceId"),
     invoices AS (SELECT i.*,i."total"-COALESCE(p.amount,0) AS balance FROM "Invoice" i LEFT JOIN paid p ON p."invoiceId"=i.id WHERE i."createdAt">=${from} AND i."createdAt"<${to} AND i.status IN ('CONFIRMED','PAID'))
     SELECT COALESCE(SUM(total),0)::text AS billed,
       (SELECT COALESCE(SUM(p.amount),0)::text FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId" WHERE p."paidAt">=${from} AND p."paidAt"<${to} AND i.status<>'CANCELLED') AS collected,
       COALESCE(SUM(balance),0)::text AS outstanding,
       COALESCE(SUM(CASE WHEN "dueAt"<${now} THEN balance ELSE 0 END),0)::text AS overdue,
       COUNT(*)::int AS "invoiceCount" FROM invoices`;
      const monthly = await tx.$queryRaw<
        { month: string; billed: string; collected: string }[]
      >`
     WITH billed AS (SELECT to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM') AS month,SUM(total) AS amount FROM "Invoice" WHERE "createdAt">=${from} AND "createdAt"<${to} AND status IN ('CONFIRMED','PAID') GROUP BY 1),
     collected AS (SELECT to_char(p."paidAt" AT TIME ZONE 'UTC','YYYY-MM') AS month,SUM(p.amount) AS amount FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId" WHERE p."paidAt">=${from} AND p."paidAt"<${to} AND i.status<>'CANCELLED' GROUP BY 1)
     SELECT COALESCE(b.month,c.month) AS month,COALESCE(b.amount,0)::text AS billed,COALESCE(c.amount,0)::text AS collected FROM billed b FULL OUTER JOIN collected c ON b.month=c.month ORDER BY month`;
      const activeSubscriptions = await tx.subscription.count({
        where: {
          status: "ACTIVE",
          startAt: { lte: now },
          expiresAt: { gt: now },
        },
      });
      const customers = await tx.user.count({ where: { role: "CUSTOMER" } });
      return {
        from,
        to,
        currency: "INR",
        totals: { ...totals, activeSubscriptions, customers },
        monthly,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
