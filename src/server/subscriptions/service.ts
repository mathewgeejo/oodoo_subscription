import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireOwnerOrStaff, requirePermission, type Actor } from "../core/permissions";
import { AppError } from "../core/errors";
import { subscriptionDraftSchema } from "./contracts";
import { transition, type SubscriptionAction } from "./lifecycle";
import { periodBoundary, firstPeriodOnOrAfter } from "../billing/calendar";
import { serializable } from "../core/transaction";
import { catalogQuotation } from "../catalog/quotation";

export async function createDraft(actor: Actor, input: unknown) {
  requirePermission(actor, "business:write");
  const fromCatalog=!!(input && typeof input==="object" && "planId" in input);
  if(!fromCatalog) requirePermission(actor, "configuration:write");
  return db.$transaction(async tx => {
    const data=fromCatalog ? await catalogQuotation(tx,input):subscriptionDraftSchema.parse(input);
    const customer = await tx.user.findUnique({where: {id: data.customerId}});
    if (!customer || customer.role !== "CUSTOMER") throw new AppError("INVALID_CUSTOMER", "Select a customer account");
    const {lines, ...values} = data;
    const billingTimezone = process.env.BUSINESS_TIMEZONE ?? "Asia/Kolkata";
    new Intl.DateTimeFormat("en", {timeZone: billingTimezone});
    const subscription = await tx.subscription.create({data: {...values, billingTimezone, number: `SUB-${randomUUID()}`, currency: "INR", lines: {create: lines}}, include: {lines: true}});
    await tx.auditEvent.create({data: {actorId: actor.id, action: "subscription.created", resourceId: subscription.id}});
    return subscription;
  });
}

export async function actOnSubscription(actor: Actor, id: string, action: SubscriptionAction, now = new Date()) {
  if (actor.role !== "CUSTOMER" || !["PAUSE", "RESUME", "CLOSE"].includes(action)) requirePermission(actor, "business:write");
  return db.$transaction(async tx => {
    const subscription = await tx.subscription.findUnique({where: {id}, include: {lines: true}});
    if (!subscription) throw new AppError("NOT_FOUND", "Resource not found", 404);
    requireOwnerOrStaff(actor, subscription.customerId);
    if (subscription.pendingAction) throw new AppError("ACTION_PENDING", "A boundary action is already pending", 409);
    if(action==="CONFIRM") {
      if(subscription.quotationExpiresAt && now>=subscription.quotationExpiresAt) throw new AppError("QUOTATION_EXPIRED","This quotation has expired; create a new quotation",409);
      if(subscription.planId){
        const plan=await tx.plan.findUnique({where:{id:subscription.planId}});
        if(!plan?.active || (plan.availableFrom && now<plan.availableFrom) || (plan.availableUntil && now>=plan.availableUntil)) throw new AppError("UNAVAILABLE_PLAN","This plan is no longer available",409);
      }
    }
    const status = transition({...subscription, now, quantity: subscription.lines.reduce((sum, line) => sum + line.quantity, 0)}, action);
    const deferred = (action === "PAUSE" || action === "CLOSE") && subscription.status === "ACTIVE" && now < subscription.expiresAt;
    // nextPeriodIndex points to the first period not yet invoiced. It must be in
    // the future before allowing a boundary request; overdue billing runs first.
    const boundary = periodBoundary(subscription.startAt, subscription.cadence, subscription.nextPeriodIndex, subscription.billingTimezone);
    if (deferred && boundary <= now) throw new AppError("BILLING_PENDING", "Process due billing before scheduling this action", 409);
    const resumeIndex = action === "RESUME" ? firstPeriodOnOrAfter(subscription.startAt, subscription.cadence, subscription.nextPeriodIndex, now, subscription.billingTimezone) : subscription.nextPeriodIndex;
    const resumeAt = periodBoundary(subscription.startAt, subscription.cadence, resumeIndex, subscription.billingTimezone);
    if (action === "RESUME" && resumeAt >= subscription.expiresAt) throw new AppError("NO_REMAINING_PERIOD", "Renew before resuming; no complete billing boundary remains", 409);
    const changed = await tx.subscription.updateMany({where: {id, version: subscription.version}, data: {
      ...(deferred ? {pendingAction: action, pendingActionAt: boundary < subscription.expiresAt ? boundary : subscription.expiresAt} : {status}),
      ...(action === "ACTIVATE" ? {nextBillingAt: subscription.startAt} : {}),
      ...(action === "QUOTE" ? {quotationExpiresAt:periodBoundary(now,"DAILY",subscription.quotationValidityDays,subscription.billingTimezone)}:{}),
      ...(action === "RESUME" ? {nextPeriodIndex: resumeIndex, nextBillingAt: resumeAt} : {}),
      version: {increment: 1},
    }});
    if (changed.count !== 1) throw new AppError("CONFLICT", "Subscription changed; reload and try again", 409);
    await tx.auditEvent.create({data: {actorId: actor.id, action: `subscription.${action.toLowerCase()}`, resourceId: id, metadata: {deferred, skippedPeriods: resumeIndex - subscription.nextPeriodIndex}}});
    return tx.subscription.findUniqueOrThrow({where: {id}, include: {lines: true}});
  }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
}

export async function renewSubscription(actor: Actor, id: string, expiresAt: Date, now = new Date()) {
  return serializable(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "id" = ${id} FOR UPDATE`;
    const subscription = await tx.subscription.findUnique({where: {id}});
    if (!subscription) throw new AppError("NOT_FOUND", "Resource not found", 404);
    requireOwnerOrStaff(actor, subscription.customerId);
    if (!subscription.canRenew || !["ACTIVE", "PAUSED", "CLOSED"].includes(subscription.status) || subscription.pendingAction) throw new AppError("RENEWAL_DISABLED", "Subscription cannot be renewed in this state", 409);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now || expiresAt < subscription.expiresAt || now < subscription.startAt) throw new AppError("INVALID_EXPIRY", "Renewal must extend the contract into the future");
    if (expiresAt.getTime() === subscription.expiresAt.getTime()) return subscription;
    const expired = now >= subscription.expiresAt;
    if (expired && subscription.status === "ACTIVE" && periodBoundary(subscription.startAt, subscription.cadence, subscription.nextPeriodIndex, subscription.billingTimezone) < subscription.expiresAt) throw new AppError("BILLING_PENDING", "Process due billing before renewing an expired contract", 409);
    const skipGap = subscription.status === "CLOSED" || (expired && subscription.status === "ACTIVE");
    const nextIndex = skipGap ? firstPeriodOnOrAfter(subscription.startAt, subscription.cadence, subscription.nextPeriodIndex, now, subscription.billingTimezone) : subscription.nextPeriodIndex;
    const nextAt = periodBoundary(subscription.startAt, subscription.cadence, nextIndex, subscription.billingTimezone);
    if (subscription.status !== "PAUSED" && nextAt >= expiresAt) throw new AppError("NO_REMAINING_PERIOD", "Renewal must include a future billing boundary");
    const updated = await tx.subscription.update({where: {id}, data: {expiresAt, status: subscription.status === "CLOSED" ? "ACTIVE" : subscription.status, nextPeriodIndex: nextIndex, nextBillingAt: subscription.status === "PAUSED" ? null : nextAt, version: {increment: 1}}});
    await tx.auditEvent.create({data: {actorId: actor.id, action: "subscription.renewed", resourceId: id, metadata: {previousExpiry: subscription.expiresAt.toISOString(), newExpiry: expiresAt.toISOString(), skippedPeriods: nextIndex - subscription.nextPeriodIndex}}});
    return updated;
  });
}
