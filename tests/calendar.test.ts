import { test } from "node:test";
import assert from "node:assert/strict";
import { duePeriods, periodBoundary, firstPeriodOnOrAfter } from "../src/server/billing/calendar";
const date = (value: string) => new Date(value + "T00:00:00Z");
test("monthly boundaries recover original month-end after clamping", () => {
  const anchor = date("2024-01-31");
  assert.equal(periodBoundary(anchor, "MONTHLY", 1).toISOString(), date("2024-02-29").toISOString());
  assert.equal(periodBoundary(anchor, "MONTHLY", 2).toISOString(), date("2024-03-31").toISOString());
  assert.equal(periodBoundary(date("2024-02-29"), "YEARLY", 1).getUTCDate(), 28);
});
test("catch-up includes due boundary, excludes expiry, and is bounded", () => {
  const periods = duePeriods(date("2026-01-01"), "DAILY", 0, date("2026-01-10"), date("2026-01-04"));
  assert.deepEqual(periods.map(x => x.index), [0, 1, 2]);
  assert.equal(duePeriods(date("2026-01-01"), "DAILY", 0, date("2026-01-10"), date("2027-01-01"), 2).length, 2);
  assert.throws(() => periodBoundary(date("2026-01-01"), "WEEKLY", -1));
});
test("monthly billing uses business dates and daily billing preserves local time across DST", () => {
  assert.equal(periodBoundary(new Date("2026-02-28T18:30:00Z"), "MONTHLY", 1, "Asia/Kolkata").toISOString(), "2026-03-31T18:30:00.000Z");
  assert.equal(periodBoundary(new Date("2026-03-07T17:00:00Z"), "DAILY", 1, "America/New_York").toISOString(), "2026-03-08T16:00:00.000Z");
});
test("resume search skips gaps, includes exact boundaries and never goes backwards", () => {
  assert.equal(firstPeriodOnOrAfter(date("2026-01-01"), "MONTHLY", 1, date("2026-03-15")), 3);
  assert.equal(firstPeriodOnOrAfter(date("2026-01-01"), "MONTHLY", 1, date("2026-03-01")), 2);
  assert.equal(firstPeriodOnOrAfter(date("2026-01-01"), "MONTHLY", 5, date("2026-03-01")), 5);
});
