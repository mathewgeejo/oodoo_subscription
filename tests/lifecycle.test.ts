import { test } from "node:test";
import assert from "node:assert/strict";
import { transition } from "../src/server/subscriptions/lifecycle";
const base = {status: "QUOTATION" as const, startAt: new Date("2026-01-01"), expiresAt: new Date("2027-01-01"), now: new Date("2026-06-01"), canPause: true, canCloseEarly: false, quantity: 5, minimumQuantity: 2};
test("valid confirmation and guarded transitions", () => {
  assert.equal(transition(base, "CONFIRM"), "CONFIRMED");
  assert.throws(() => transition(base, "ACTIVATE"));
  assert.throws(() => transition({...base, quantity: 1}, "CONFIRM"));
  assert.throws(() => transition({...base, status: "ACTIVE"}, "CLOSE"));
  assert.throws(() => transition({...base, status: "ACTIVE", canPause: false}, "PAUSE"));
});
test("activation/resume rejects expired or future contracts", () => {
  assert.equal(transition({...base, status: "CONFIRMED"}, "ACTIVATE"), "ACTIVE");
  assert.throws(() => transition({...base, status: "PAUSED", now: base.expiresAt}, "RESUME"));
  assert.throws(() => transition({...base, status: "CONFIRMED", now: new Date("2025-01-01")}, "ACTIVATE"));
});
