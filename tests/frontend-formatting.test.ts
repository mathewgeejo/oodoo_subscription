import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../src/components/api";
test("display formatting preserves cents beyond JavaScript safe integer limits",()=>{
  assert.equal(money("9007199254740993.01").replace(/[₹,]/g,""),"9007199254740993.01");
  assert.equal(money("0"),"₹0.00");
  assert.equal(money("141.6","USD"),"USD 141.60");
});
