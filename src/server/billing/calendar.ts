import type { Cadence } from "../core/contracts";
import { Temporal } from "@js-temporal/polyfill";

/** Derive periods from the original anchor, not the last clamped date.
 * Jan 31 -> Feb 28 -> Mar 31 rather than permanently drifting to the 28th. */
export function periodBoundary(anchor: Date, cadence: Cadence, index: number, timeZone = "UTC"): Date {
  if (!Number.isFinite(anchor.getTime()) || !Number.isSafeInteger(index) || index < 0) throw new Error("Invalid billing anchor or period index");
  const local = Temporal.Instant.fromEpochMilliseconds(anchor.getTime()).toZonedDateTimeISO(timeZone);
  const duration = cadence === "DAILY" ? {days: index} : cadence === "WEEKLY" ? {weeks: index} : cadence === "MONTHLY" ? {months: index} : {years: index};
  const result = new Date(local.add(duration).epochMilliseconds);
  if (!Number.isFinite(result.getTime())) throw new Error("Billing boundary out of range");
  return result;
}

export function duePeriods(anchor: Date, cadence: Cadence, nextIndex: number, now: Date, expiresAt: Date, limit = 100, timeZone = "UTC") {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= anchor || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid billing window");
  const periods: {index: number; start: Date; end: Date}[] = [];
  for (let index = nextIndex; periods.length < limit; index++) {
    const start = periodBoundary(anchor, cadence, index, timeZone);
    if (start > now || start >= expiresAt) break;
    const next = periodBoundary(anchor, cadence, index + 1, timeZone);
    periods.push({index, start, end: next > expiresAt ? new Date(expiresAt) : next});
  }
  return periods;
}
/** Binary search skips paused/closed periods without iterating every missed day. */
export function firstPeriodOnOrAfter(anchor: Date, cadence: Cadence, minimumIndex: number, now: Date, timeZone = "UTC") {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid resume date");
  let low = minimumIndex;
  let high = Math.max(minimumIndex, 1);
  while (periodBoundary(anchor, cadence, high, timeZone) < now) high *= 2;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (periodBoundary(anchor, cadence, middle, timeZone) < now) low = middle + 1;
    else high = middle;
  }
  return low;
}
