import type { Cadence } from "../core/contracts";

/** Derive periods from the original anchor, not the last clamped date.
 * Jan 31 -> Feb 28 -> Mar 31 rather than permanently drifting to the 28th. */
export function periodBoundary(anchor: Date, cadence: Cadence, index: number): Date {
  if (!Number.isFinite(anchor.getTime()) || !Number.isSafeInteger(index) || index < 0) throw new Error("Invalid billing anchor or period index");
  const result = new Date(anchor);
  if (cadence === "DAILY" || cadence === "WEEKLY") result.setUTCDate(anchor.getUTCDate() + index * (cadence === "WEEKLY" ? 7 : 1));
  else {
    const month = anchor.getUTCMonth() + index * (cadence === "YEARLY" ? 12 : 1);
    result.setUTCDate(1);
    result.setUTCFullYear(anchor.getUTCFullYear(), month, 1);
    const last = new Date(result);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    result.setUTCDate(Math.min(anchor.getUTCDate(), last.getUTCDate()));
  }
  if (!Number.isFinite(result.getTime())) throw new Error("Billing boundary out of range");
  return result;
}

export function duePeriods(anchor: Date, cadence: Cadence, nextIndex: number, now: Date, expiresAt: Date, limit = 100) {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= anchor || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid billing window");
  const periods: {index: number; start: Date; end: Date}[] = [];
  for (let index = nextIndex; periods.length < limit; index++) {
    const start = periodBoundary(anchor, cadence, index);
    if (start > now || start >= expiresAt) break;
    const next = periodBoundary(anchor, cadence, index + 1);
    periods.push({index, start, end: next > expiresAt ? new Date(expiresAt) : next});
  }
  return periods;
}
