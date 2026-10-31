import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireOwnerOrStaff, requirePermission, type Actor } from "../core/permissions";
import { AppError } from "../core/errors";
import { subscriptionDraftSchema } from "./contracts";
import { transition, type SubscriptionAction } from "./lifecycle";
import { periodBoundary } from "../billing/calendar";

export async function createDraft(actor: Actor, input: unknown) {
  requirePermission(actor, "business:write");
  const data = subscriptionDraftSchema.parse(input);
  // Plan configuration is Pranav's domain. Until integrated, manual quotes are
  // admin-only so staff cannot invent catalog prices or lifecycle permissions.
  requirePermission(actor, "configuration:write");
  return db.$transaction(async tx => {
    const customer = await tx.user.findUnique({where: {id: data.customerId}});
    if (!customer || customer.role !== "CUSTOMER") throw new AppError("INVALID_CUSTOMER", "Select a customer account");
    const {lines, ...values} = data;
    const subscription = await tx.subscription.create({data: {...values, number: `SUB-${randomUUID()}`, currency: "INR", lines: {create: lines}}, include: {lines: true}});
    await tx.auditEvent.create({data: {actorId: actor.id, action: "subscription.created", resourceId: subscription.id}});
    return subscription;
  });
}

export async function actOnSubscription(actor: Actor, id: string, action: SubscriptionAction, now = new Date()) {
  requirePermission(actor, "business:write");
  return db.$transaction(async tx => {
    const subscription = await tx.subscription.findUnique({where: {id}, include: {lines: true}});
    if (!subscription) throw new AppError("NOT_FOUND", "Subscription not found", 404);
    requireOwnerOrStaff(actor, subscription.customerId);
    if (subscription.pendingAction) throw new AppError("ACTION_PENDING", "A boundary action is already pending", 409);
    const status = transition({...subscription, now, quantity: subscription.lines.reduce((sum, line) => sum + line.quantity, 0)}, action);
    const deferred = (action === "PAUSE" || action === "CLOSE") && subscription.status === "ACTIVE" && now < subscription.expiresAt;
    // nextPeriodIndex points to the first period not yet invoiced. It must be in
    // the future before allowing a boundary request; overdue billing runs first.
    const boundary = periodBoundary(subscription.startAt, subscription.cadence, subscription.nextPeriodIndex);
    if (deferred && boundary <= now) throw new AppError("BILLING_PENDING", "Process due billing before scheduling this action", 409);
    if (action === "RESUME") throw new AppError("NOT_IMPLEMENTED", "Resume scheduling requires the billing worker integration", 409);
    const changed = await tx.subscription.updateMany({where: {id, version: subscription.version}, data: {
      ...(deferred ? {pendingAction: action, pendingActionAt: boundary < subscription.expiresAt ? boundary : subscription.expiresAt} : {status}),
      ...(action === "ACTIVATE" ? {nextBillingAt: subscription.startAt} : {}),
      version: {increment: 1},
    }});
    if (changed.count !== 1) throw new AppError("CONFLICT", "Subscription changed; reload and try again", 409);
    await tx.auditEvent.create({data: {actorId: actor.id, action: `subscription.${action.toLowerCase()}`, resourceId: id, metadata: {deferred}}});
    return tx.subscription.findUniqueOrThrow({where: {id}, include: {lines: true}});
  }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
}
