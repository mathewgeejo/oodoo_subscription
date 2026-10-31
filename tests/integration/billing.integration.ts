import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../../src/server/db";
import { createDraft, actOnSubscription } from "../../src/server/subscriptions/service";
import { billSubscription } from "../../src/server/billing/service";
import { provisionUser } from "../../src/server/auth/provision";
import type { Actor } from "../../src/server/core/permissions";

if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Set matching DATABASE_URL and TEST_DATABASE_URL for a dedicated *_test database");
let actor: Actor;
let customerId: string;
before(async () => {
  const id = randomUUID();
  const admin = await db.user.findFirst({where: {role: "ADMIN"}}) ?? await provisionUser({name: "Test admin", email: `admin-${id}@example.test`, password: "TestPassword!"});
  actor = {id: admin.id, role: "ADMIN"};
  customerId = randomUUID();
  await db.user.create({data: {id: customerId, name: "Test customer", email: `${customerId}@example.test`}});
});
after(() => db.$disconnect());
const jan = new Date("2026-01-01T00:00:00Z");
async function active(expiresAt = "2027-01-01T00:00:00Z") {
  const draft = await createDraft(actor, {customerId, planName: "Monthly test", cadence: "MONTHLY", basePrice: "100", baseTaxPercent: "18", startAt: jan.toISOString(), expiresAt, lines: [{description: "Seats", quantity: 2, unitPrice: "10", taxPercent: "18"}]});
  for (const action of ["QUOTE", "CONFIRM", "ACTIVATE"] as const) await actOnSubscription(actor, draft.id, action, jan);
  return draft;
}
test("migration checks and admin bootstrap are enforced by the real database", async () => {
  await assert.rejects(() => db.user.create({data: {id: randomUUID(), name: "Bad email", email: `UPPER-${randomUUID()}@example.test`}}));
  await assert.rejects(() => provisionUser({name: "Second admin", email: `${randomUUID()}@example.test`, password: "TestPassword!"}), /administrator already exists/);
});
test("concurrent billing creates one immutable period invoice and advances once", async () => {
  const subscription = await active();
  const invoices = await Promise.all(Array.from({length: 8}, () => billSubscription(subscription.id, jan)));
  assert.equal(invoices.filter(Boolean).length, 1);
  const invoice = await db.invoice.findFirstOrThrow({where: {subscriptionId: subscription.id}, include: {lines: true}});
  assert.equal(invoice.total.toFixed(2), "141.60");
  assert.equal(invoice.status, "CONFIRMED");
  assert.equal(invoice.lines.length, 2);
  assert.equal((await db.subscription.findUniqueOrThrow({where: {id: subscription.id}})).nextPeriodIndex, 1);
  assert.equal(await billSubscription(subscription.id, jan), null);
});
test("downtime catches up all periods before expiry and auto-closes without an extra invoice", async () => {
  const subscription = await active("2026-03-01T00:00:00Z");
  const now = new Date("2026-04-01T00:00:00Z");
  for (let i = 0; i < 4; i++) await billSubscription(subscription.id, now);
  assert.equal(await db.invoice.count({where: {subscriptionId: subscription.id}}), 2);
  assert.equal((await db.subscription.findUniqueOrThrow({where: {id: subscription.id}})).status, "CLOSED");
});
test("pause applies at the next boundary without creating a charge for the paused period", async () => {
  const subscription = await active();
  await db.subscription.update({where: {id: subscription.id}, data: {canPause: true}});
  await billSubscription(subscription.id, jan);
  await actOnSubscription(actor, subscription.id, "PAUSE", new Date("2026-01-15T00:00:00Z"));
  await billSubscription(subscription.id, new Date("2026-02-01T00:00:00Z"));
  assert.equal((await db.subscription.findUniqueOrThrow({where: {id: subscription.id}})).status, "PAUSED");
  assert.equal(await db.invoice.count({where: {subscriptionId: subscription.id}}), 1);
});
