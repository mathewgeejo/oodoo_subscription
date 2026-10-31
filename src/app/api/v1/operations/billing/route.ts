import { z } from "zod";
import { requireActor, requireSameOrigin } from "../../../../../server/auth/actor";
import { requirePermission } from "../../../../../server/core/permissions";
import { errorResponse } from "../../../../../server/core/errors";
import { db } from "../../../../../server/db";
export async function GET(request: Request) {
  try {
    requirePermission(await requireActor(request), "configuration:write");
    const [heartbeat, failures, paymentExceptions, unexpectedReceipts] = await db.$transaction([
      db.workerHeartbeat.findUnique({where: {id: "billing"}}),
      db.subscription.findMany({where: {billingFailureCount: {gt: 0}}, select: {id: true, number: true, billingFailureCount: true, billingRetryAt: true, billingLastError: true}, orderBy: {billingRetryAt: "asc"}, take: 100}),
      db.checkoutAttempt.findMany({where: {status: "EXCEPTION"}, select: {id: true, invoiceId: true, amount: true, currency: true, receivedAmount: true, receivedCurrency: true, failureCode: true, providerPaymentId: true}, take: 100, orderBy: {updatedAt: "desc"}}),
      db.providerReceipt.findMany({where: {outcome: "EXCEPTION"}, take: 100, orderBy: {createdAt: "desc"}}),
    ]);
    return Response.json({data: {heartbeat, failures, paymentExceptions, unexpectedReceipts, healthy: !!heartbeat && Date.now() - heartbeat.lastSeen.getTime() < 60000}});
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    requirePermission(actor, "configuration:write");
    const {subscriptionId} = z.object({subscriptionId: z.string().min(1).max(100)}).parse(await request.json());
    await db.$transaction(async tx => {
      await tx.subscription.update({where: {id: subscriptionId}, data: {billingRetryAt: null, billingFailureCount: 0, billingLastError: null}});
      await tx.auditEvent.create({data: {actorId: actor.id, action: "billing.retry_requested", resourceId: subscriptionId}});
    });
    return Response.json({data: {retryRequested: true}});
  } catch (error) { return errorResponse(error); }
}
