import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../../src/server/db";
import { createDraft, actOnSubscription, renewSubscription } from "../../src/server/subscriptions/service";
import { billSubscription } from "../../src/server/billing/service";
import { provisionUser } from "../../src/server/auth/provision";
import type { Actor } from "../../src/server/core/permissions";
import { getInvoice, actOnInvoice, listInvoices } from "../../src/server/invoices/service";
import { recordManualPayment } from "../../src/server/payments/manual";
import { runBillingBatch } from "../../src/server/billing/worker";
import { GET as readiness } from "../../src/app/api/ready/route";

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
  assert.equal((await readiness()).status, 200);
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
  await assert.rejects(() => actOnSubscription({id: "other-customer", role: "CUSTOMER"}, subscription.id, "RESUME", new Date("2026-03-15T00:00:00Z")));
  const resumed = await actOnSubscription({id: customerId, role: "CUSTOMER"}, subscription.id, "RESUME", new Date("2026-03-15T00:00:00Z"));
  assert.equal(resumed.nextPeriodIndex, 3);
  assert.equal(await billSubscription(subscription.id, new Date("2026-03-15T00:00:00Z")), null);
  await billSubscription(subscription.id, new Date("2026-04-01T00:00:00Z"));
  assert.equal(await db.invoice.count({where: {subscriptionId: subscription.id}}), 2);
});
test("renewal preserves history and does not bill a closed gap", async () => {
  const sub = await active("2026-03-01T00:00:00Z");
  const now = new Date("2026-04-01T00:00:00Z");
  await assert.rejects(() => renewSubscription(actor, sub.id, new Date("2026-07-01T00:00:00Z"), now), /Process due billing/);
  for (let i = 0; i < 3; i++) await billSubscription(sub.id, now);
  const renewed = await renewSubscription({id: customerId, role: "CUSTOMER"}, sub.id, new Date("2026-07-01T00:00:00Z"), now);
  assert.equal(renewed.nextPeriodIndex, 3);
  assert.equal(renewed.status, "ACTIVE");
  await billSubscription(sub.id, now);
  assert.equal(await db.invoice.count({where: {subscriptionId: sub.id}}), 3);
  assert.equal(await db.auditEvent.count({where: {resourceId: sub.id, action: "subscription.renewed"}}), 1);
});
test("renewal skips expired gaps even when automatic closure is disabled", async () => {
  const sub = await active("2026-03-01T00:00:00Z");
  await db.subscription.update({where: {id: sub.id}, data: {autoClose: false}});
  const now = new Date("2026-04-01T00:00:00Z");
  for (let i = 0; i < 3; i++) await billSubscription(sub.id, now);
  const renewed = await renewSubscription(actor, sub.id, new Date("2026-07-01T00:00:00Z"), now);
  assert.equal(renewed.nextPeriodIndex, 3);
});
test("partial payments retry idempotently, close the balance, and prevent cancellation", async () => {
  const sub = await active();
  const invoice = (await billSubscription(sub.id, jan))!;
  const input = {idempotencyKey: randomUUID(), amount: "50", method: "BANK_TRANSFER", externalReference: "TEST-REF"};
  const first = await recordManualPayment(actor, invoice.id, input);
  assert.equal((await recordManualPayment(actor, invoice.id, input)).id, first.id);
  await assert.rejects(() => recordManualPayment(actor, invoice.id, {...input, amount: "51"}));
  assert.equal((await getInvoice({id: customerId, role: "CUSTOMER"}, invoice.id)).balance, "91.60");
  await recordManualPayment(actor, invoice.id, {idempotencyKey: randomUUID(), amount: "91.60", method: "CASH"});
  assert.equal((await getInvoice(actor, invoice.id)).status, "PAID");
  await assert.rejects(() => actOnInvoice(actor, invoice.id, "CANCEL"));
});
test("concurrent payments cannot overpay and customers cannot record manual payments", async () => {
  const sub = await active();
  const invoice = (await billSubscription(sub.id, jan))!;
  const results = await Promise.allSettled(Array.from({length: 2}, () => recordManualPayment(actor, invoice.id, {idempotencyKey: randomUUID(), amount: "100", method: "CARD"})));
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal((await getInvoice(actor, invoice.id)).balance, "41.60");
  await assert.rejects(() => recordManualPayment({id: customerId, role: "CUSTOMER"}, invoice.id, {idempotencyKey: randomUUID(), amount: "1", method: "CASH"}));
  await assert.rejects(() => getInvoice({id: "other-customer", role: "CUSTOMER"}, invoice.id));
  assert.equal((await listInvoices({id: "other-customer", role: "CUSTOMER"}, {})).pagination.total, 0);
  assert.ok((await listInvoices({id: customerId, role: "CUSTOMER"}, {})).data.some(row => row.id === invoice.id));
});
test("cancelled invoices stop accepting payments and expose zero receivable", async () => {
  const sub = await active();
  const invoice = (await billSubscription(sub.id, jan))!;
  await actOnInvoice(actor, invoice.id, "CANCEL");
  assert.equal((await getInvoice(actor, invoice.id)).balance, "0.00");
  await assert.rejects(() => recordManualPayment(actor, invoice.id, {idempotencyKey: randomUUID(), amount: "1", method: "CASH"}));
});
test("worker persists heartbeat and backs off failed jobs while billing healthy subscriptions", async () => {
  const broken = await active();
  await db.subscription.update({where: {id: broken.id}, data: {basePrice: "9999999999999999.99"}});
  const healthy = await active();
  await runBillingBatch(jan, 1000);
  const failed = await db.subscription.findUniqueOrThrow({where: {id: broken.id}});
  assert.equal(failed.billingFailureCount, 1);
  assert.ok(failed.billingRetryAt! > jan);
  assert.equal(await db.invoice.count({where: {subscriptionId: broken.id}}), 0);
  assert.equal(await db.invoice.count({where: {subscriptionId: healthy.id}}), 1);
  assert.ok(await db.workerHeartbeat.findUnique({where: {id: "billing"}}));
});
