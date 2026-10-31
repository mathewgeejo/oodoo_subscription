"use client";
import { useState } from "react";
import { useData, Loading, Failure, Empty } from "./data";
import { money } from "./api";
import { useUser } from "./session";
type Report = {
  currency: string;
  totals: {
    billed: string;
    collected: string;
    outstanding: string;
    overdue: string;
    activeSubscriptions: number;
    customers: number;
    invoiceCount: number;
  };
  monthly: { month: string; billed: string; collected: string }[];
};
export function Reports() {
  const user = useUser();
  const now = new Date();
  const [from, setFrom] = useState(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
      .toISOString()
      .slice(0, 10),
  );
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const result = useData<{ data: Report }>(
    `/api/v1/reports?from=${encodeURIComponent(`${from}T00:00:00Z`)}&to=${encodeURIComponent(Number.isFinite(end.getTime()) ? end.toISOString() : "")}`,
  );
  if (user.role === "CUSTOMER")
    return <Empty title="Reporting is available to your billing team" />;
  const report = result.data?.data;
  const maximum = Math.max(
    ...(report?.monthly.map((row) => Number(row.billed)) ?? [0]),
    1,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>Reports</h1>
          <p>
            Invoice revenue and payments collected, reconciled to your records.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <label>
          From
          <input
            type="date"
            required
            value={from}
            onChange={(e) => {
              if (e.target.value) setFrom(e.target.value);
            }}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            required
            value={to}
            onChange={(e) => {
              if (e.target.value) setTo(e.target.value);
            }}
          />
        </label>
        <span className="muted">UTC dates · up to one year</span>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Failure error={result.error} retry={result.reload} />
      ) : (
        report && (
          <>
            <div className="stats-grid">
              {[
                ["Billed revenue", report.totals.billed],
                ["Payments collected", report.totals.collected],
                ["Outstanding", report.totals.outstanding],
                ["Overdue", report.totals.overdue],
              ].map(([label, value]) => (
                <article className="stat-card" key={label}>
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{money(value)}</div>
                </article>
              ))}
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Revenue over time</h2>
                  <p>
                    {report.totals.activeSubscriptions} active subscriptions
                    today · {report.totals.customers} customers ·{" "}
                    {report.totals.invoiceCount} issued invoices in range
                  </p>
                </div>
              </div>
              <div className="form-panel">
                <p className="muted">
                  Billed uses invoice issue dates. Collected uses payment dates.
                  Outstanding and overdue refer to invoices issued in this
                  range. Draft and cancelled invoices are excluded.
                </p>
                {report.monthly.length ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Billed</th>
                        <th>Collected</th>
                        <th aria-label="Billed comparison" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.monthly.map((row) => (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{money(row.billed)}</td>
                          <td>{money(row.collected)}</td>
                          <td>
                            <div
                              className="report-bar"
                              style={{
                                width: `${Math.max(1, (Number(row.billed) / maximum) * 100)}%`,
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Empty title="No issued invoices in this range" />
                )}
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
