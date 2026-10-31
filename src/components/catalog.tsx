"use client";
import { useState, type FormEvent } from "react";
import { useUser } from "./session";
import { useData, Loading, Failure, Empty, type PageData } from "./data";
import { api, money } from "./api";
import { LineEditor, type QuoteLine, type Choice } from "./quotation-form";
type Resource = "products" | "plans" | "templates" | "taxes" | "discounts";
type Entry = Choice & Record<string, unknown>;
type Field = {
  key: string;
  label: string;
  type?: "money" | "integer" | "date" | "boolean" | "text";
  options?: string[];
  initial?: string | number | boolean;
  nullable?: boolean;
};
const common: Field[] = [
  { key: "name", label: "Name" },
  { key: "active", label: "Active", type: "boolean", initial: true },
];
const fields: Record<Resource, Field[]> = {
  products: [
    ...common,
    {
      key: "type",
      label: "Product type",
      options: ["SERVICE", "DIGITAL", "PHYSICAL"],
    },
    { key: "salesPrice", label: "Sale price", type: "money" },
    { key: "costPrice", label: "Cost price", type: "money" },
    { key: "notes", label: "Notes", initial: "" },
  ],
  plans: [
    ...common,
    { key: "basePrice", label: "Base price", type: "money" },
    {
      key: "baseTaxPercent",
      label: "Base tax % (without tax rule)",
      type: "money",
    },
    {
      key: "cadence",
      label: "Billing cadence",
      options: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
    },
    {
      key: "minimumQuantity",
      label: "Minimum quantity",
      type: "integer",
      initial: 1,
    },
    {
      key: "availableFrom",
      label: "Available from",
      type: "date",
      nullable: true,
    },
    {
      key: "availableUntil",
      label: "Available until",
      type: "date",
      nullable: true,
    },
    ...(["canPause", "canRenew", "canCloseEarly", "autoClose"] as const).map(
      (key, index) => ({
        key,
        label: [
          "Allow pause",
          "Allow renewal",
          "Allow early closure",
          "Close at expiry",
        ][index],
        type: "boolean" as const,
        initial: key === "canRenew" || key === "autoClose",
      }),
    ),
  ],
  templates: [
    ...common,
    {
      key: "validityDays",
      label: "Quotation validity (days)",
      type: "integer",
      initial: 14,
    },
  ],
  taxes: [...common, { key: "percent", label: "Tax percent", type: "money" }],
  discounts: [
    ...common,
    { key: "kind", label: "Discount type", options: ["FIXED", "PERCENTAGE"] },
    { key: "value", label: "Discount value", type: "money" },
    {
      key: "minimumPurchase",
      label: "Minimum eligible subtotal",
      type: "money",
    },
    {
      key: "minimumQuantity",
      label: "Minimum quantity",
      type: "integer",
      initial: 1,
    },
    { key: "startsAt", label: "Starts at", type: "date" },
    { key: "endsAt", label: "Ends at", type: "date" },
    {
      key: "usageLimit",
      label: "Maximum invoice uses",
      type: "integer",
      initial: 100,
    },
  ],
};
export function Catalog() {
  const user = useUser();
  const [resource, setResource] = useState<Resource>("products");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Entry | null | undefined>(undefined);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [variants, setVariants] = useState<
    { name: string; priceAdjustment: string }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const result = useData<PageData<Entry>>(
    `/api/v1/catalog/${resource}?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
  );
  const products = useData<PageData<Choice>>(
    "/api/v1/catalog/products?pageSize=100",
  );
  const plans = useData<PageData<Choice>>("/api/v1/catalog/plans?pageSize=100");
  const taxes = useData<PageData<Choice>>("/api/v1/catalog/taxes?pageSize=100");
  function open(row: Entry | null) {
    setEdit(row);
    setError("");
    setLines(
      (row?.lines as QuoteLine[] | undefined) ?? [
        { productId: "", variantId: null, quantity: 1 },
      ],
    );
    setVariants(
      (row?.variants as
        { name: string; priceAdjustment: string }[] | undefined) ?? [],
    );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const data: Record<string, unknown> = {};
      for (const field of fields[resource]) {
        const value = String(form.get(field.key) ?? "");
        data[field.key] =
          field.type === "boolean"
            ? form.has(field.key)
            : field.type === "integer"
              ? Number(value)
              : field.type === "date"
                ? value
                  ? new Date(value).toISOString()
                  : null
                : value;
      }
      if (resource === "products") {
        data.variants = variants;
        data.taxRuleId = form.get("taxRuleId") || null;
      }
      if (resource === "plans") data.taxRuleId = form.get("taxRuleId") || null;
      if (resource === "templates") {
        data.planId = form.get("planId");
        data.lines = lines;
      }
      if (resource === "discounts") data.productIds = form.getAll("productIds");
      await api(`/api/v1/catalog/${resource}${edit ? `/${edit.id}` : ""}`, {
        method: edit ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      setEdit(undefined);
      result.reload();
      products.reload();
      plans.reload();
      taxes.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user.role === "CUSTOMER")
    return <Empty title="The catalog is managed by your billing team" />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUILD YOUR OFFERING</span>
          <h1>Catalog</h1>
          <p>Products, recurring plans and reusable commercial rules.</p>
        </div>
        {user.role === "ADMIN" && (
          <button className="button button-primary" onClick={() => open(null)}>
            Add {resource === "taxes" ? "tax rule" : resource.slice(0, -1)}
          </button>
        )}
      </div>
      <nav className="catalog-tabs" aria-label="Catalog sections">
        {Object.keys(fields).map((key) => (
          <button
            className={`button ${resource === key ? "button-primary" : ""}`}
            key={key}
            aria-pressed={resource === key}
            onClick={() => {
              setResource(key as Resource);
              setPage(1);
              setSearch("");
              setEdit(undefined);
              setError("");
            }}
          >
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </nav>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {edit !== undefined && (
        <section className="panel">
          <form
            key={`${resource}-${edit?.id ?? "new"}`}
            className="form-panel"
            onSubmit={save}
          >
            <h2>
              {edit ? "Edit" : "New"}{" "}
              {resource === "taxes" ? "tax rule" : resource.slice(0, -1)}
            </h2>
            <div className="form-grid">
              {fields[resource].map((field) => {
                const value =
                  edit?.[field.key] ??
                  field.initial ??
                  (field.type === "money" ? "0" : "");
                return (
                  <label key={field.key}>
                    {field.type === "boolean" ? (
                      <>
                        <input
                          type="checkbox"
                          name={field.key}
                          defaultChecked={Boolean(value)}
                        />{" "}
                        {field.label}
                      </>
                    ) : (
                      <>
                        {field.label}
                        {field.options ? (
                          <select
                            name={field.key}
                            defaultValue={String(value || field.options[0])}
                          >
                            {field.options.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            name={field.key}
                            type={
                              field.type === "date"
                                ? "datetime-local"
                                : field.type === "money" ||
                                    field.type === "integer"
                                  ? "number"
                                  : "text"
                            }
                            required={!field.nullable && field.key !== "notes"}
                            min={
                              field.type === "integer"
                                ? 1
                                : field.type === "money"
                                  ? 0
                                  : undefined
                            }
                            max={
                              field.key === "percent" ||
                              field.key === "baseTaxPercent"
                                ? 100
                                : undefined
                            }
                            step={field.type === "money" ? "0.01" : undefined}
                            maxLength={field.key === "notes" ? 5000 : 200}
                            defaultValue={
                              field.type === "date"
                                ? String(value).slice(0, 16)
                                : String(value)
                            }
                          />
                        )}
                      </>
                    )}
                  </label>
                );
              })}
              {(resource === "products" || resource === "plans") && (
                <label>
                  Tax rule
                  <select
                    name="taxRuleId"
                    defaultValue={String(edit?.taxRuleId ?? "")}
                  >
                    <option value="">
                      {resource === "plans" ? "Use base tax percent" : "No tax"}
                    </option>
                    {taxes.data?.data
                      .filter((row) => row.active)
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {resource === "templates" && (
                <label>
                  Plan
                  <select
                    name="planId"
                    required
                    defaultValue={String(edit?.planId ?? "")}
                  >
                    <option value="">Select plan</option>
                    {plans.data?.data
                      .filter((row) => row.active)
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            {resource === "products" && (
              <fieldset className="line-editor">
                <legend>Variants and additional charges</legend>
                {variants.map((variant, index) => (
                  <div className="line-row" key={index}>
                    <label>
                      Variant name
                      <input
                        required
                        value={variant.name}
                        onChange={(e) =>
                          setVariants(
                            variants.map((row, i) =>
                              i === index
                                ? { ...row, name: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Additional price
                      <input
                        required
                        type="number"
                        min={0}
                        step="0.01"
                        value={variant.priceAdjustment}
                        onChange={(e) =>
                          setVariants(
                            variants.map((row, i) =>
                              i === index
                                ? { ...row, priceAdjustment: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        setVariants(variants.filter((_, i) => i !== index))
                      }
                    >
                      Remove variant
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    setVariants([
                      ...variants,
                      { name: "", priceAdjustment: "0" },
                    ])
                  }
                >
                  Add variant
                </button>
              </fieldset>
            )}
            {resource === "templates" && (
              <LineEditor
                lines={lines}
                onChange={setLines}
                products={products.data?.data ?? []}
              />
            )}
            {resource === "discounts" && (
              <fieldset className="line-editor">
                <legend>Eligible products</legend>
                <p>
                  Leave all unchecked to apply to the entire subscription,
                  including its base charge.
                </p>
                {products.data?.data.map((row) => (
                  <label className="check-label" key={row.id}>
                    <input
                      type="checkbox"
                      name="productIds"
                      value={row.id}
                      defaultChecked={(
                        (edit?.productIds ?? []) as string[]
                      ).includes(row.id)}
                    />
                    {row.name}
                  </label>
                ))}
                {edit && (
                  <p>{String(edit.usageCount ?? 0)} invoice uses consumed.</p>
                )}
              </fieldset>
            )}
            <div className="actions">
              <button className="button button-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setEdit(undefined)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Search catalog"
            placeholder="Search catalog…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {user.role !== "ADMIN" && (
            <span className="muted">
              Configuration is managed by an administrator.
            </span>
          )}
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <Failure error={result.error} retry={result.reload} />
        ) : !result.data?.data.length ? (
          <Empty title="No entries found" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      {resource === "products" &&
                        row.variants?.map((variant) => (
                          <small className="table-sub" key={variant.id}>
                            {variant.name} +{money(variant.priceAdjustment)}
                          </small>
                        ))}
                    </td>
                    <td>
                      {resource === "products"
                        ? money(String(row.salesPrice))
                        : resource === "plans"
                          ? `${money(String(row.basePrice))} · ${row.cadence}`
                          : resource === "taxes"
                            ? `${row.percent}%`
                            : resource === "templates"
                              ? `${row.validityDays} day validity`
                              : `${row.value}${row.kind === "PERCENTAGE" ? "%" : " fixed"} · ${row.usageCount}/${row.usageLimit} uses`}
                    </td>
                    <td>{row.active ? "Active" : "Archived"}</td>
                    <td>
                      {user.role === "ADMIN" && (
                        <button className="button" onClick={() => open(row)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <span>{result.data?.pagination.total ?? 0} entries</span>
          <div className="actions">
            <button
              className="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="button"
              disabled={
                !result.data || page * 20 >= result.data.pagination.total
              }
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
