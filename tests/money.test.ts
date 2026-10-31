import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateInvoice, invoiceBalance } from "../src/server/billing/money";
test("decimal arithmetic, discount before tax, and partial payment balance", () => {
  const invoice = calculateInvoice([{description: "Seats", quantity: 3, unitPrice: "0.10", taxPercent: "18"}], "0.10");
  assert.equal(invoice.total, "0.24");
  assert.equal(invoice.tax, "0.04");
  assert.equal(invoiceBalance(invoice.total, ["0.10"]), "0.14");
  assert.throws(() => invoiceBalance("1", ["1.01"]));
});
test("proportional allocation preserves every cent and caps discount", () => {
  const lines = Array.from({length: 3}, () => ({description: "Item", quantity: 1, unitPrice: "1", taxPercent: "0"}));
  assert.deepEqual(calculateInvoice(lines, "1").lines.map(x => x.discount), ["0.33", "0.34", "0.33"]);
  assert.equal(calculateInvoice(lines, "100").total, "0.00");
  assert.throws(() => calculateInvoice([{...lines[0], quantity: -1}]));
});
test("large amounts preserve cents and reject database decimal overflow", () => {
  assert.equal(calculateInvoice([{description: "Large", quantity: 1, unitPrice: "9999999999999999.99", taxPercent: "0"}]).total, "9999999999999999.99");
  assert.throws(() => calculateInvoice([{description: "Overflow", quantity: 2, unitPrice: "9999999999999999.99", taxPercent: "0"}]));
});
