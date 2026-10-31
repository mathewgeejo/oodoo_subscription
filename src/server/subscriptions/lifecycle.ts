import { AppError } from "../core/errors";
export type SubscriptionStatus = "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "CLOSED";
export type SubscriptionAction = "QUOTE" | "CONFIRM" | "ACTIVATE" | "PAUSE" | "RESUME" | "CLOSE";
type Context = {
  status: SubscriptionStatus; startAt: Date; expiresAt: Date; now: Date;
  canPause: boolean; canCloseEarly: boolean; quantity: number; minimumQuantity: number;
};
const transitions: Record<SubscriptionAction, {from: SubscriptionStatus; to: SubscriptionStatus}> = {
  QUOTE: {from: "DRAFT", to: "QUOTATION"}, CONFIRM: {from: "QUOTATION", to: "CONFIRMED"},
  ACTIVATE: {from: "CONFIRMED", to: "ACTIVE"}, PAUSE: {from: "ACTIVE", to: "PAUSED"},
  RESUME: {from: "PAUSED", to: "ACTIVE"}, CLOSE: {from: "ACTIVE", to: "CLOSED"},
};
/** PAUSE/CLOSE returns the requested boundary state. Persistence must schedule it,
 * and only apply that state at the next billing boundary. */
export function transition(context: Context, action: SubscriptionAction): SubscriptionStatus {
  const rule = transitions[action];
  const closeAllowed = action === "CLOSE" && ["PAUSED", "CONFIRMED"].includes(context.status);
  if (!rule || (context.status !== rule.from && !closeAllowed)) throw new AppError("INVALID_TRANSITION", "Subscription action is not allowed in this state", 409);
  if (![context.startAt, context.expiresAt, context.now].every(x => Number.isFinite(x.getTime())) || context.expiresAt <= context.startAt) throw new AppError("INVALID_DATES", "Invalid subscription dates");
  if (action === "CONFIRM" && (!Number.isSafeInteger(context.quantity) || context.quantity < context.minimumQuantity)) throw new AppError("MINIMUM_QUANTITY", "Minimum plan quantity is not met");
  if (["ACTIVATE", "RESUME"].includes(action) && (context.now < context.startAt || context.now >= context.expiresAt)) throw new AppError("OUTSIDE_CONTRACT", "Subscription is outside its active dates", 409);
  if (action === "PAUSE" && !context.canPause) throw new AppError("PAUSE_DISABLED", "Plan does not permit pausing", 409);
  if (action === "CLOSE" && context.now < context.expiresAt && !context.canCloseEarly) throw new AppError("EARLY_CLOSE_DISABLED", "Plan does not permit early closure", 409);
  return rule.to;
}
