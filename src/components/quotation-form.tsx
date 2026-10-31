"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./session";
import { useData, Loading, Failure, Empty, type PageData } from "./data";
import { api, money } from "./api";
export type Choice = {
  id: string;
  name: string;
  active: boolean;
  planId?: string;
  minimumQuantity?: number;
  basePrice?: string;
  salesPrice?: string;
  variants?: {
    id: string;
    name: string;
    active: boolean;
    priceAdjustment: string;
  }[];
};
export type QuoteLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
};
export function LineEditor({
  lines,
  onChange,
  products,
}: {
  lines: QuoteLine[];
  onChange: (lines: QuoteLine[]) => void;
  products: Choice[];
}) {
  const update = (index: number, values: Partial<QuoteLine>) =>
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...values } : line)),
    );
  return (
    <fieldset className="line-editor">
      <legend>Products</legend>
      {lines.map((line, index) => (
        <div className="line-row" key={index}>
          <label>
            Product
            <select
              required
              value={line.productId}
              onChange={(e) =>
                update(index, { productId: e.target.value, variantId: null })
              }
            >
              <option value="">Select product</option>
              {products
                .filter((row) => row.active)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.salesPrice ? ` · ${money(row.salesPrice)}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Variant
            <select
              value={line.variantId ?? ""}
              onChange={(e) =>
                update(index, { variantId: e.target.value || null })
              }
            >
              <option value="">Standard</option>
              {products
                .find((row) => row.id === line.productId)
                ?.variants?.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name} (+{money(variant.priceAdjustment)})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              required
              type="number"
              min={1}
              max={1000000}
              value={line.quantity}
              onChange={(e) =>
                update(index, { quantity: Number(e.target.value) })
              }
            />
          </label>
          <button
            type="button"
            className="button"
            aria-label={`Remove product ${index + 1}`}
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button"
        onClick={() =>
          onChange([...lines, { productId: "", variantId: null, quantity: 1 }])
        }
      >
        Add product
      </button>
    </fieldset>
  );
}
export function QuotationForm() {
  const user = useUser();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const customers = useData<PageData<Choice>>(
    `/api/v1/customers?pageSize=100&search=${encodeURIComponent(search)}`,
  );
  const plans = useData<PageData<Choice>>("/api/v1/catalog/plans?pageSize=100");
  const templates = useData<PageData<Choice>>(
    "/api/v1/catalog/templates?pageSize=100",
  );
  const products = useData<PageData<Choice>>(
    "/api/v1/catalog/products?pageSize=100",
  );
  const [planId, setPlanId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([
    { productId: "", variantId: null, quantity: 1 },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const result = await api<{ data: { id: string } }>(
        "/api/v1/subscriptions",
        {
          method: "POST",
          body: JSON.stringify({
            customerId: fields.get("customerId"),
            planId,
            templateId: templateId || undefined,
            lines: templateId ? undefined : lines,
            startAt: new Date(
              `${fields.get("startAt")}T00:00:00Z`,
            ).toISOString(),
            expiresAt: new Date(
              `${fields.get("expiresAt")}T00:00:00Z`,
            ).toISOString(),
            paymentTermDays: Number(fields.get("paymentTermDays")),
          }),
        },
      );
      router.push(`/subscriptions/${result.data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user.role === "CUSTOMER")
    return <Empty title="Your billing team creates quotations" />;
  const failed = [customers, plans, templates, products].find(
    (result) => result.error,
  );
  if (failed) return <Failure error={failed.error} retry={failed.reload} />;
  if (
    [customers, plans, templates, products].some(
      (result) => result.loading && !result.data,
    )
  )
    return <Loading />;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A NEW RELATIONSHIP</span>
          <h1>New quotation</h1>
          <p>
            Choose a plan and products. Prices, tax and permissions come from
            the catalog.
          </p>
        </div>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <form className="form-panel" onSubmit={submit}>
          <label>
            Find a customer
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
            />
          </label>
          <div className="form-grid">
            <label>
              Customer
              <select name="customerId" required>
                <option value="">Select customer</option>
                {customers.data?.data.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select
              name="planId"
                required
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setTemplateId("");
                }}
              >
                <option value="">Select plan</option>
                {plans.data?.data
                  .filter((row) => row.active)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {money(row.basePrice ?? "0")} base
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Quotation template
              <select
              name="templateId"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Choose products below</option>
                {templates.data?.data
                  .filter((row) => row.active && row.planId === planId)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Start date (UTC)
              <input name="startAt" type="date" required defaultValue={today} />
            </label>
            <label>
              Expiry date (UTC)
              <input
                name="expiresAt"
                type="date"
                required
                defaultValue={nextYear.toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Payment terms (days)
              <input
                name="paymentTermDays"
                type="number"
                min={0}
                max={365}
                required
                defaultValue={14}
              />
            </label>
          </div>
          {templateId ? (
            <p>
              The selected template supplies its product lines and quotation
              validity.
            </p>
          ) : (
            <LineEditor
              lines={lines}
              onChange={setLines}
              products={products.data?.data ?? []}
            />
          )}
          <p className="muted">
            Plan minimum quantity:{" "}
            {plans.data?.data.find((row) => row.id === planId)
              ?.minimumQuantity ?? "—"}
            . Product charges are added to the plan base charge.
          </p>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Creating…" : "Create draft"}
          </button>
        </form>
      </section>
    </>
  );
}
