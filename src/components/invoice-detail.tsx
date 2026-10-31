"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { api, ApiError, money, date } from "./api";
import {
  useData,
  Status,
  Loading,
  Failure,
  Empty,
  type Invoice,
  type PageData,
} from "./data";
import { useUser } from "./session";
type Detail = Invoice & {
  subtotal: string;
  discount: string;
  tax: string;
  overdue: boolean;
  periodStart: string;
  periodEnd: string;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: string;
    discount: string;
    tax: string;
    total: string;
  }[];
};
type Payment = {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
  note: string | null;
  externalReference: string | null;
};
type Checkout = {
  attempt: {
    id: string;
    status: string;
    url: string | null;
    expiresAt: string;
  } | null;
  needsReconciliation: boolean;
};
export function InvoiceDetail({ id }: { id: string }) {
  const user = useUser();
  const invoice = useData<{ data: Detail }>(`/api/v1/invoices/${id}`);
  const checkout = useData<{ data: Checkout }>(
    `/api/v1/invoices/${id}/checkout`,
  );
  const [page, setPage] = useState(1);
  const payments = useData<PageData<Payment>>(
    `/api/v1/invoices/${id}/payments?page=${page}&pageSize=10`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const checkoutKey = useRef<string | null>(null);
  const paymentKey = useRef<string | null>(null);
  const attempt = checkout.data?.data.attempt;
  const held =
    !!checkout.data?.data.needsReconciliation ||
    ["OPEN", "RESERVING", "EXCEPTION"].includes(attempt?.status || "");
  useEffect(() => {
    if (!attempt || !["OPEN", "RESERVING"].includes(attempt.status)) return;
    const timer = setInterval(() => {
      checkout.reload();
      invoice.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [attempt?.status, id]);
  async function act(action: string) {
    if (action === "CANCEL" && !confirm("Cancel this unpaid invoice?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/v1/invoices/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      invoice.reload();
      setMessage("Invoice updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (attempt?.status === "OPEN" && attempt.url) {
        location.assign(attempt.url);
        return;
      }
      checkoutKey.current ??= crypto.randomUUID();
      const response = await api<{
        data: { status: string; url: string | null };
      }>(`/api/v1/invoices/${id}/checkout`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: checkoutKey.current }),
      });
      if (response.data.status === "OPEN" && response.data.url)
        location.assign(response.data.url);
      else {
        invoice.reload();
        checkout.reload();
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? "Online payments are temporarily unavailable. Please try again later or contact Brightloop."
          : (e as Error).message,
      );
      checkout.reload();
    } finally {
      setBusy(false);
    }
  }
  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    paymentKey.current ??= crypto.randomUUID();
    try {
      await api(`/api/v1/invoices/${id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: paymentKey.current,
          amount: fields.get("amount"),
          method: fields.get("method"),
          paidAt: new Date(
            String(fields.get("paidAt")) + "T00:00:00",
          ).toISOString(),
          note: fields.get("note"),
          externalReference: fields.get("reference"),
        }),
      });
      paymentKey.current = null;
      form.reset();
      setShowPayment(false);
      setMessage("Payment recorded successfully.");
      invoice.reload();
      payments.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (invoice.loading && !invoice.data) return <Loading />;
  if (invoice.error)
    return <Failure error={invoice.error} retry={invoice.reload} />;
  const inv = invoice.data!.data;
  const internal = user.role !== "CUSTOMER";
  async function sendInvoice() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ data: { status: string } }>(
        `/api/v1/invoices/${id}/send`,
        { method: "POST", body: "{}" },
      );
      setMessage(
        result.data.status === "SENT"
          ? "This invoice has already been sent."
          : result.data.status === "SKIPPED"
            ? "Delivery is skipped for synthetic demo addresses."
            : "Invoice email queued. Delivery requires the worker and configured SMTP.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="text-link" href="/invoices">
        ← All invoices
      </Link>
      <div className="page-heading" style={{ marginTop: 22 }}>
        <div>
          <span className="eyebrow">BILLING, IN BLACK & WHITE</span>
          <h1>Invoice</h1>
          <p style={{ overflowWrap: "anywhere" }}>{inv.number}</p>
        </div>
        <div className="actions">
          <Status value={inv.status} />
          {internal && ["CONFIRMED", "PAID"].includes(inv.status) && (
            <button className="button" disabled={busy} onClick={sendInvoice}>
              Send invoice
            </button>
          )}
          <button className="button" onClick={() => window.print()}>
            Print invoice ↗
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice notice-success">
          {message}
        </div>
      )}
      {checkout.data?.data.needsReconciliation && (
        <div role="alert" className="notice notice-error">
          This online payment needs review. Please contact Brightloop before
          making another payment.
        </div>
      )}
      {attempt?.status === "RESERVING" && (
        <div role="status" className="notice notice-success">
          Your online checkout is being confirmed. We'll refresh its status
          automatically.
        </div>
      )}
      <section className="panel invoice-document">
        <div className="panel-heading">
          <div>
            <h2>Brightloop Software</h2>
            <p>Subscription invoice</p>
          </div>
          <strong>
            {money(inv.balance, inv.currency)}{" "}
            <small className="muted" style={{ fontWeight: 400 }}>
              outstanding
            </small>
          </strong>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Billed to</dt>
            <dd>
              {inv.customerName}
              <small
                className="muted"
                style={{ display: "block", marginTop: 6 }}
              >
                {inv.customerEmail}
              </small>
            </dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{date(inv.createdAt)}</dd>
          </div>
          <div>
            <dt>
              Due date{" "}
              {inv.overdue && (
                <span style={{ color: "#b85d44" }}>· Overdue</span>
              )}
            </dt>
            <dd>{date(inv.dueAt)}</dd>
          </div>
          <div>
            <dt>Billing period</dt>
            <dd>
              {date(inv.periodStart)} – {date(inv.periodEnd)}
            </dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{inv.currency}</dd>
          </div>
          <div>
            <dt>Subscription</dt>
            <dd>
              <Link
                href={`/subscriptions/${inv.subscriptionId}`}
                className="text-link"
              >
                View agreement →
              </Link>
            </dd>
          </div>
        </dl>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <strong>{line.description}</strong>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{money(line.unitPrice, inv.currency)}</td>
                  <td>{money(line.discount, inv.currency)}</td>
                  <td>{money(line.tax, inv.currency)}</td>
                  <td>
                    <strong>{money(line.total, inv.currency)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{money(inv.subtotal, inv.currency)}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>− {money(inv.discount, inv.currency)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{money(inv.tax, inv.currency)}</span>
          </div>
          <div className="total">
            <span>Total</span>
            <span>{money(inv.total, inv.currency)}</span>
          </div>
          <div>
            <span>Outstanding balance</span>
            <strong>{money(inv.balance, inv.currency)}</strong>
          </div>
        </div>
      </section>
      <section className="panel actions-panel">
        <div className="actions">
          {inv.status === "CONFIRMED" &&
            inv.balance !== "0.00" &&
            !checkout.data?.data.needsReconciliation &&
            attempt?.status !== "RESERVING" && (
              <button
                className="button button-primary"
                disabled={busy || checkout.loading || !!checkout.error}
                onClick={pay}
              >
                {attempt?.status === "OPEN"
                  ? "Continue secure payment →"
                  : "Pay securely →"}
              </button>
            )}
          {internal && inv.status === "CONFIRMED" && !held && (
            <button
              className="button"
              disabled={busy || checkout.loading || !!checkout.error}
              onClick={() => setShowPayment(!showPayment)}
            >
              Record a payment
            </button>
          )}
          {internal && inv.status === "DRAFT" && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => act("CONFIRM")}
            >
              Confirm invoice
            </button>
          )}
          {internal &&
            ["DRAFT", "CONFIRMED"].includes(inv.status) &&
            !held &&
            new Decimal(inv.balance).eq(inv.total) && (
              <button
                className="button"
                disabled={busy || checkout.loading || !!checkout.error}
                onClick={() => act("CANCEL")}
              >
                Cancel invoice
              </button>
            )}
          {inv.status === "PAID" && (
            <span className="text-link">✓ Payment complete. Thank you.</span>
          )}
          <button
            className="button button-quiet"
            disabled={busy}
            onClick={() => {
              invoice.reload();
              checkout.reload();
              payments.reload();
            }}
          >
            ↻ Refresh status
          </button>
        </div>
        {checkout.error && (
          <p className="muted" role="alert">
            Unable to check online payment status. Refresh before making a
            payment.
          </p>
        )}
        {showPayment && !held && (
          <form className="form-panel" onSubmit={record}>
            <div className="form-grid">
              <label>
                Amount
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="amount"
                  defaultValue={inv.balance}
                  required
                />
              </label>
              <label>
                Payment method
                <select name="method">
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Payment date
                <input
                  type="date"
                  name="paidAt"
                  defaultValue={new Date().toLocaleDateString("en-CA")}
                  required
                />
              </label>
              <label>
                Reference
                <input name="reference" maxLength={200} />
              </label>
            </div>
            <label>
              Note
              <textarea name="note" maxLength={2000} rows={2} />
            </label>
            <button className="button button-primary" disabled={busy}>
              Save payment
            </button>
          </form>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Payment history</h2>
            <p>A clear record of every payment.</p>
          </div>
        </div>
        {payments.loading ? (
          <Loading />
        ) : payments.error ? (
          <Failure error={payments.error} retry={payments.reload} />
        ) : !payments.data?.data.length ? (
          <Empty
            title="No payments yet"
            description="Payments will appear here once received or recorded."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.data.map((payment) => (
                  <tr key={payment.id}>
                    <td>{date(payment.paidAt)}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {payment.method.toLowerCase().replaceAll("_", " ")}
                    </td>
                    <td>{payment.externalReference || "—"}</td>
                    <td>
                      <strong>{money(payment.amount, inv.currency)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <span>
            {payments.data?.pagination.total || 0} payments · Page {page}
          </span>
          <div className="actions">
            <button
              className="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="button"
              disabled={
                !payments.data || page * 10 >= payments.data.pagination.total
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
