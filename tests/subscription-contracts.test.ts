import { test } from "node:test";
import assert from "node:assert/strict";
import { subscriptionDraftSchema } from "../src/server/subscriptions/contracts";
test("draft validates dates, line quantities and bounded tax rates", () => {
  const input = {customerId: "customer", planName: "Monthly", cadence: "MONTHLY", basePrice: "100", startAt: "2026-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z", lines: [{description: "Seats", quantity: 2, unitPrice: "100", taxPercent: "18"}]};
  assert.equal(subscriptionDraftSchema.parse(input).paymentTermDays, 14);
  assert.equal(subscriptionDraftSchema.safeParse({...input, expiresAt: input.startAt}).success, false);
  assert.equal(subscriptionDraftSchema.safeParse({...input, lines: [{...input.lines[0], taxPercent: "101"}]}).success, false);
});
