import DecimalJs from "decimal.js";
import { moneySchema } from "../core/contracts";
const Decimal = DecimalJs.clone({ precision: 40, rounding: DecimalJs.ROUND_HALF_UP });

export const decimal = (value: string) => new Decimal(value);
export const rounded = (value: DecimalJs) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const amount = (value: string) => decimal(moneySchema.parse(value));
export type InvoiceInputLine = { description: string; quantity: number; unitPrice: string; taxPercent: string };

/** Tax-exclusive amounts. Allocate fixed invoice discount by cumulative rounded shares,
 * so all allocated cents sum exactly to the invoice discount. */
export function calculateInvoice(lines: InvoiceInputLine[], discount = "0") {
  if (!lines.length) throw new Error("Invoice requires at least one line");
  const subtotals = lines.map(line => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error("Quantity must be a positive integer");
    if (amount(line.taxPercent).gt(100)) throw new Error("Tax percentage exceeds 100");
    return rounded(amount(line.unitPrice).mul(line.quantity));
  });
  const subtotal = subtotals.reduce((a, b) => a.plus(b), decimal("0"));
  const saving = Decimal.min(amount(discount), subtotal);
  let cumulative = decimal("0");
  let allocated = decimal("0");
  const result = lines.map((line, i) => {
    cumulative = cumulative.plus(subtotals[i]);
    const target = subtotal.isZero() ? decimal("0") : rounded(saving.mul(cumulative).div(subtotal));
    const lineDiscount = target.minus(allocated);
    allocated = target;
    const net = subtotals[i].minus(lineDiscount);
    const tax = rounded(net.mul(line.taxPercent).div(100));
    return {...line, subtotal: subtotals[i].toFixed(2), discount: lineDiscount.toFixed(2), tax: tax.toFixed(2), total: net.plus(tax).toFixed(2)};
  });
  const tax = result.reduce((a, b) => a.plus(b.tax), decimal("0"));
  if ([subtotal, tax, subtotal.minus(saving).plus(tax)].some(value => value.gt("9999999999999999.99"))) throw new Error("Invoice exceeds supported monetary range");
  return {lines: result, subtotal: subtotal.toFixed(2), discount: saving.toFixed(2), tax: tax.toFixed(2), total: subtotal.minus(saving).plus(tax).toFixed(2)};
}

export function invoiceBalance(total: string, payments: string[]) {
  const paid = payments.reduce((sum, value) => sum.plus(amount(value)), decimal("0"));
  if (paid.gt(amount(total))) throw new Error("Payments exceed invoice total");
  return amount(total).minus(paid).toFixed(2);
}
