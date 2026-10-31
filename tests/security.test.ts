import { test } from "node:test";
import assert from "node:assert/strict";
import { emailSchema, passwordSchema, moneySchema, paginationSchema } from "../src/server/core/contracts";
import { requireOwnerOrStaff, requirePermission } from "../src/server/core/permissions";

test("normalize email and enforce exact PDF password requirements", () => {
  assert.equal(emailSchema.parse("  Person@Example.com "), "person@example.com");
  for (const value of ["Abcdefg!", "abcdefghi!", "ABCDEFGHI!", "Abcdefghi1", "Abcdefghi "]) assert.equal(passwordSchema.safeParse(value).success, false);
  assert.equal(passwordSchema.safeParse("Abcdefgh!").success, true);
});
test("bound pagination and reject unsafe monetary inputs", () => {
  assert.deepEqual(paginationSchema.parse({}), {page: 1, pageSize: 25});
  for (const value of ["-1", "NaN", "1e4", "0.001"]) assert.equal(moneySchema.safeParse(value).success, false);
  assert.equal(paginationSchema.safeParse({pageSize: 101}).success, false);
});
test("only admin configures rules or creates staff; customers cannot inspect others", () => {
  const customer = {id: "a", role: "CUSTOMER" as const};
  assert.throws(() => requirePermission({id: "s", role: "STAFF"}, "staff:create"));
  assert.throws(() => requirePermission(customer, "business:write"));
  assert.throws(() => requireOwnerOrStaff(customer, "b"));
  requireOwnerOrStaff(customer, "a");
  requirePermission({id: "a", role: "ADMIN"}, "staff:create");
});
