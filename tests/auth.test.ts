import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { requireSameOrigin } from "../src/server/auth/actor";
import { staffInputSchema } from "../src/server/auth/provision";

test("staff input uses normalized email and same password policy", () => {
  assert.equal(staffInputSchema.parse({name: " Staff ", email: " STAFF@EXAMPLE.COM ", password: "StrongPass!"}).email, "staff@example.com");
  assert.equal(staffInputSchema.safeParse({name: "Staff", email: "staff@example.com", password: "weak"}).success, false);
});
test("cookie-authenticated writes reject cross-origin and missing-origin requests", () => {
  const previous = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://brightloop.example";
  try {
    requireSameOrigin(new Request("https://brightloop.example/api/v1/staff", {headers: {origin: "https://brightloop.example"}}));
    assert.throws(() => requireSameOrigin(new Request("https://brightloop.example", {headers: {origin: "https://attacker.example"}})));
    assert.throws(() => requireSameOrigin(new Request("https://brightloop.example")));
  } finally { if (previous === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = previous; }
});
test("provisioned credential hashes are compatible with authentication verification", async () => {
  const password = "StrongPassword!";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword({password, hash}), true);
  assert.equal(await verifyPassword({password: "WrongPassword!", hash}), false);
});
