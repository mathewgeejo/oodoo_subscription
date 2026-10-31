"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, money, date } from "./api";
import { useUser } from "./session";
import { useData, Status, Loading, Failure, type Subscription } from "./data";
type Detail = Subscription & {
  baseTaxPercent: string;
  pendingActionAt: string | null;
  customer: { name: string; email: string };
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: string;
    taxPercent: string;
  }[];
};
export function SubscriptionDetail({ id }: { id: string }) {
  const user = useUser();
  const router = useRouter();
  const result = useData<{ data: Detail }>(`/api/v1/subscriptions/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function action(value: string) {
    if (
      value === "CLOSE" &&
      !confirm(
        "Close this subscription according to its plan's closure policy?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (value === "BILL") {
        const response = await api<{ data: { id: string } | null }>(
          `/api/v1/subscriptions/${id}/bill`,
          { method: "POST", body: "{}" },
        );
        if (response.data) router.push(`/portal/invoices/${response.data.id}`);
        else setMessage("No invoice is due for this subscription yet.");
      } else {
        await api(`/api/v1/subscriptions/${id}/actions`, {
          method: "POST",
          body: JSON.stringify({ action: value }),
        });
        setMessage("Subscription updated.");
      }
      result.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function renew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const fields = new FormData(event.currentTarget);
    try {
      await api(`/api/v1/subscriptions/${id}/renew`, {
        method: "POST",
        body: JSON.stringify({
          expiresAt: new Date(
            String(fields.get("expiry")) + "T23:59:59",
          ).toISOString(),
        }),
      });
      setMessage("Your subscription has been renewed.");
      result.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (result.loading) return <Loading />;
  if (result.error)
    return <Failure error={result.error} retry={result.reload} />;
  const sub = result.data!.data;
  const internal = user.role !== "CUSTOMER";
  const actions: { label: string; value: string }[] = [];
  if (internal && sub.status === "DRAFT")
    actions.push({ label: "Send to quotation", value: "QUOTE" });
  if (internal && sub.status === "QUOTATION")
    actions.push({ label: "Confirm subscription", value: "CONFIRM" });
  if (
    internal &&
    sub.status === "CONFIRMED" &&
    new Date(sub.startAt) <= new Date()
  )
    actions.push({ label: "Activate subscription", value: "ACTIVATE" });
  if (sub.status === "ACTIVE" && sub.canPause)
    actions.push({ label: "Pause subscription", value: "PAUSE" });
  if (sub.status === "PAUSED")
    actions.push({ label: "Resume subscription", value: "RESUME" });
  if (
    ["ACTIVE", "PAUSED", "CONFIRMED"].includes(sub.status) &&
    (sub.canCloseEarly || new Date(sub.expiresAt) <= new Date())
  )
    actions.push({ label: "Close subscription", value: "CLOSE" });
  if (internal && sub.status === "ACTIVE")
    actions.push({ label: "Generate due invoice", value: "BILL" });
  return (
    <>
      <Link className="text-link" href="/subscriptions">
        ← All subscriptions
      </Link>
      <div className="page-heading" style={{ marginTop: 22 }}>
        <div>
          <span className="eyebrow">SUBSCRIPTION DETAILS</span>
          <h1>{sub.planName}</h1>
          <p style={{ overflowWrap: "anywhere" }}>{sub.number}</p>
        </div>
        <Status value={sub.status} />
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
      {sub.pendingAction && (
        <div role="status" className="notice notice-success">
          {sub.pendingAction === "PAUSE" ? "Pause" : "Closure"} scheduled
          {sub.pendingActionAt
            ? ` for ${date(sub.pendingActionAt)}`
            : " at the next billing boundary"}
          .
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Plan & agreement</h2>
          <Link className="text-link" href="/invoices">
            View invoices →
          </Link>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Customer</dt>
            <dd>{sub.customer.name}</dd>
          </div>
          <div>
            <dt>Billing cadence</dt>
            <dd style={{ textTransform: "capitalize" }}>
              {sub.cadence.toLowerCase()}
            </dd>
          </div>
          <div>
            <dt>Recurring base charge</dt>
            <dd>{money(sub.basePrice, sub.currency)}</dd>
          </div>
          <div>
            <dt>Start date</dt>
            <dd>{date(sub.startAt)}</dd>
          </div>
          <div>
            <dt>Expiry date</dt>
            <dd>{date(sub.expiresAt)}</dd>
          </div>
          <div>
            <dt>Base charge tax</dt>
            <dd>{sub.baseTaxPercent}%</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Products & add-ons</h2>
            <p>Additional items on this agreement.</p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Tax</th>
              </tr>
            </thead>
            <tbody>
              {sub.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <strong>{line.description}</strong>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{money(line.unitPrice, sub.currency)}</td>
                  <td>{line.taxPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {actions.length > 0 && !sub.pendingAction && (
        <section className="panel actions-panel">
          <div className="actions">
            {actions.map((item) => (
              <button
                className="button"
                key={item.value}
                disabled={busy}
                onClick={() => action(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 15 }}>
            Pauses and early closures follow your plan's billing-boundary
            policy.
          </p>
        </section>
      )}
      {sub.canRenew &&
        ["ACTIVE", "PAUSED", "CLOSED"].includes(sub.status) &&
        !sub.pendingAction && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Keep the good things going</h2>
                <p>Extend your agreement with a new expiry date.</p>
              </div>
            </div>
            <form className="form-panel" onSubmit={renew}>
              <label>
                Renew until
                <input name="expiry" type="date" required />
              </label>
              <button className="button button-primary" disabled={busy}>
                Renew subscription →
              </button>
            </form>
          </section>
        )}
    </>
  );
}
