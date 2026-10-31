import { test } from "node:test";
import assert from "node:assert/strict";
import { trustedOriginsFor } from "../src/server/auth/origins";
test("development accepts only same-port loopback aliases",()=>{
  const allowed=trustedOriginsFor("http://localhost:3100",{environment:"development"});
  assert.deepEqual(allowed.sort(),["http://localhost:3100","http://127.0.0.1:3100","http://[::1]:3100"].sort());
  assert.ok(!allowed.includes("http://localhost:3000"));
  assert.ok(!allowed.includes("https://localhost:3100"));
  assert.ok(!allowed.includes("http://attacker.example:3100"));
  assert.ok(trustedOriginsFor("http://127.0.0.1:3100",{environment:"development"}).includes("http://localhost:3100"));
});
test("production and remote development hosts do not trust implicit aliases",()=>{
  assert.deepEqual(trustedOriginsFor("https://brightloop.example",{environment:"production"}),["https://brightloop.example"]);
  assert.deepEqual(trustedOriginsFor("http://localhost:3100",{environment:"production"}),["http://localhost:3100"]);
  assert.deepEqual(trustedOriginsFor("https://brightloop.example",{environment:"development"}),["https://brightloop.example"]);
});
test("additional deployment origins are explicit, deduplicated and cannot be wildcard URLs",()=>{
  assert.deepEqual(trustedOriginsFor("https://brightloop.example",{extraOrigins:"https://portal.example, https://brightloop.example"}),["https://brightloop.example","https://portal.example"]);
  for(const origin of ["file:///tmp","https://*.example.com","https://user:secret@example.com","https://example.com/path","https://example.com?query=1"]) assert.throws(()=>trustedOriginsFor("https://brightloop.example",{extraOrigins:origin}));
});
