import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError, errorResponse } from "../src/server/core/errors";
import { emailSchema } from "../src/server/core/contracts";
test("API errors distinguish validation, malformed JSON, authorization and conflicts", async () => {
  assert.equal(errorResponse(new SyntaxError()).status, 400);
  assert.equal(errorResponse(new AppError("FORBIDDEN", "Access denied", 403)).status, 403);
  assert.equal(errorResponse({code: "P2002", secret: "database details"}).status, 409);
  const result = emailSchema.safeParse("invalid");
  assert.equal(errorResponse(result.error).status, 422);
  assert.equal(JSON.stringify(await errorResponse({code: "P2034", secret: "database details"}).json()).includes("database details"), false);
});
