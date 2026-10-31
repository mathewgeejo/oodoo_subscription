import { test } from "node:test";
import assert from "node:assert/strict";
import { productSchema, planSchema, discountRuleSchema } from "../src/server/catalog/contracts";
test("catalog inputs reject duplicate variants and invalid prices", () => {
  const product = {name: "Business software", type: "DIGITAL", salesPrice: "1000", costPrice: "200", variants: [{name: "Odoo", priceAdjustment: "560"}]};
  assert.equal(productSchema.parse(product).variants[0].priceAdjustment, "560");
  assert.equal(productSchema.safeParse({...product, variants: [...product.variants, ...product.variants]}).success, false);
  assert.equal(productSchema.safeParse({...product, salesPrice: "-1"}).success, false);
});
test("plan availability and discount dates/percentages are bounded", () => {
  assert.equal(planSchema.safeParse({name: "Monthly", basePrice: "100", cadence: "MONTHLY", availableFrom: "2026-12-01T00:00:00Z", availableUntil: "2026-11-01T00:00:00Z"}).success, false);
  const rule = {name: "Seats", kind: "PERCENTAGE", value: "10", startsAt: "2026-01-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z", usageLimit: 10};
  assert.equal(discountRuleSchema.safeParse(rule).success, true);
  assert.equal(discountRuleSchema.safeParse({...rule, value: "101"}).success, false);
  assert.equal(discountRuleSchema.safeParse({...rule, usageLimit: 0}).success, false);
});
