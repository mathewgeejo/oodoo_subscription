import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/health/route";
test("liveness responds without database or provider credentials", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {status: "ok", service: "brightloop-web"});
});
