import { db } from "../db";
import { billSubscription } from "./service";

/** Jobs are due subscriptions in PostgreSQL, not an in-memory timer queue.
 * Restarting the process preserves both due dates and retry delays. */
export async function runBillingBatch(now = new Date(), limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid worker batch limit");
  await db.workerHeartbeat.upsert({where: {id: "billing"}, create: {id: "billing", lastSeen: now}, update: {lastSeen: now}});
  const due = await db.subscription.findMany({
    where: {AND: [
      {OR: [{status: "ACTIVE", nextBillingAt: {lte: now}}, {status: "PAUSED", autoClose: true, expiresAt: {lte: now}}]},
      {OR: [{billingRetryAt: null}, {billingRetryAt: {lte: now}}]},
    ]},
    orderBy: [{nextBillingAt: "asc"}, {id: "asc"}], take: limit, select: {id: true, status: true, version: true, billingFailureCount: true},
  });
  let billed = 0;
  let failures = 0;
  for (const subscription of due) {
    try { if (await billSubscription(subscription.id, now)) billed++; }
    catch (error) {
      failures++;
      const code = error && typeof error === "object" && "code" in error ? String(error.code).slice(0, 100) : "BILLING_FAILED";
      const delay = Math.min(60 * 60 * 1000, 5000 * 2 ** Math.min(subscription.billingFailureCount, 10));
      await db.subscription.updateMany({where: {id: subscription.id, version: subscription.version, status: subscription.status}, data: {billingFailureCount: {increment: 1}, billingLastError: code, billingRetryAt: new Date(now.getTime() + delay), version: {increment: 1}}});
    }
  }
  return {scanned: due.length, billed, failures};
}
