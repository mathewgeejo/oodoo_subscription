import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, randomInt } from "node:crypto";
import { SMTPServer } from "smtp-server";
import { getAuth } from "../../src/server/auth/config";
import { provisionUser } from "../../src/server/auth/provision";
import { db } from "../../src/server/db";

if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Use matching URLs for a dedicated *_test database");
const email = `security-${randomUUID()}@example.test`;
const messages: string[] = [];
const smtp = new SMTPServer({authOptional: true, disabledCommands: ["AUTH", "STARTTLS"], onData(stream, _session, callback) {
  let data = "";
  stream.on("data", chunk => {data += chunk.toString();});
  stream.on("end", () => {messages.push(data); callback();});
}});
const base = "http://localhost:3100";
before(async () => {
  await new Promise<void>(resolve => smtp.listen(0, "127.0.0.1", resolve));
  const address = smtp.server.address();
  if (!address || typeof address === "string") throw new Error("SMTP listener unavailable");
  Object.assign(process.env, {BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: randomBytes(32).toString("base64"), SMTP_HOST: "127.0.0.1", SMTP_PORT: String(address.port), SMTP_FROM: "billing@example.test"});
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
});
after(async () => {await new Promise<void>(resolve => smtp.close(resolve)); await db.$disconnect();});
const clientIp = `192.0.2.${randomInt(1, 200)}`;
const post = (path: string, body: unknown, ip = clientIp) => getAuth().handler(new Request(base + "/api/auth/" + path, {method: "POST", headers: {origin: base, "x-forwarded-for": ip, "content-type": "application/json"}, body: JSON.stringify(body)}));

test("public signup enforces password policy and cannot assign privileged roles", async () => {
  const weak = await post("sign-up/email", {email, name: "Security test", password: "weak"});
  assert.ok(weak.status >= 400);
  const response = await post("sign-up/email", {email: email.toUpperCase(), name: "Security test", password: "TestPassword!", role: "ADMIN"});
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await db.user.findUniqueOrThrow({where: {email}})).role, "CUSTOMER");
  assert.ok((await post("sign-up/email", {email, name: "Duplicate", password: "TestPassword!"})).status >= 400);
});
test("only an administrator can provision a staff account against the real database", async () => {
  const admin = await db.user.findFirst({where: {role: "ADMIN"}}) ?? await provisionUser({name: "Test admin", email: `${randomUUID()}@example.test`, password: "TestPassword!"});
  const input = {name: "Staff test", email: `staff-${randomUUID()}@example.test`, password: "TestPassword!"};
  await assert.rejects(() => provisionUser(input, {id: "customer", role: "CUSTOMER"}));
  const staff = await provisionUser(input, {id: admin.id, role: "ADMIN"});
  assert.equal(staff.role, "STAFF");
  const signin = await post("sign-in/email", {email: input.email, password: input.password}, "198.51.100.11");
  assert.equal(signin.status, 200, await signin.clone().text());
});
test("reset emails are delivered locally, tokens are single use and old sessions are revoked", async () => {
  const login = await post("sign-in/email", {email, password: "TestPassword!"});
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const known = await post("request-password-reset", {email, redirectTo: base + "/reset-password"});
  const unknown = await post("request-password-reset", {email: `missing-${randomUUID()}@example.test`, redirectTo: base + "/reset-password"});
  assert.equal(known.status, 200, await known.clone().text());
  assert.deepEqual(await known.json(), await unknown.json());
  assert.equal(messages.length, 1);
  const message = messages[0].replace(/=\r?\n/g, "").replace(/=3D/g, "=");
  const token = message.match(/\/api\/auth\/reset-password\/([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(token, "SMTP message contains the reset link");
  const reset = await post("reset-password", {token, newPassword: "ReplacementPassword!"});
  assert.equal(reset.status, 200, await reset.clone().text());
  assert.ok((await post("reset-password", {token, newPassword: "ReplayPassword!"})).status >= 400);
  const session = await getAuth().handler(new Request(base + "/api/auth/get-session", {headers: {cookie, "x-forwarded-for": clientIp}}));
  assert.equal(await session.json(), null);
  assert.ok((await post("sign-in/email", {email, password: "TestPassword!"})).status >= 400);
  assert.equal((await post("sign-in/email", {email, password: "ReplacementPassword!"})).status, 200);
  await post("request-password-reset", {email, redirectTo: base + "/reset-password"});
  const expiredToken = messages[1].replace(/=\r?\n/g, "").match(/\/api\/auth\/reset-password\/([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(expiredToken);
  const expired = await db.verification.updateMany({where: {identifier: `reset-password:${expiredToken}`}, data: {expiresAt: new Date(0)}});
  assert.equal(expired.count, 1);
  assert.equal((await post("reset-password", {token: expiredToken, newPassword: "ExpiredPassword!"})).status, 400);
});
test("repeated password attempts remain rate limited", async () => {
  const statuses: number[] = [];
  // Exercise a single fresh client bucket rather than the successful-login bucket.
  const ip = `198.51.100.${randomInt(20, 240)}`;
  for (let index = 0; index < 5; index++) statuses.push((await post("sign-in/email", {email, password: "WrongPassword!"}, ip)).status);
  assert.ok(statuses.includes(429));
});
