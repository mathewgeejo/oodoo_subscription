"use client";
import { useState } from "react";
import Link from "next/link";
import { useData, Loading, Failure, Empty } from "./data";
import { api, date, money } from "./api";
import { useUser } from "./session";
type OperationsData = {
  deliveryFailures: {
    id: string;
    invoiceId: string;
    lastError: string;
    attempts: number;
  }[];
  healthy: boolean;
  heartbeat: { lastSeen: string } | null;
  failures: {
    id: string;
    number: string;
    billingFailureCount: number;
    billingRetryAt: string;
    billingLastError: string;
  }[];
  pendingCheckouts: {
    id: string;
    invoiceId: string;
    amount: string;
    status: string;
  }[];
  paymentExceptions: { id: string; invoiceId: string; failureCode: string }[];
  unexpectedReceipts: { id: string; invoiceId: string; reason: string }[];
};
export function Operations() {
  const user = useUser();
  const result = useData<{ data: OperationsData }>(
    "/api/v1/operations/billing",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function retry(id: string) {
    setBusy(id);
    setError("");
    try {
      await api("/api/v1/operations/billing", {
        method: "POST",
        body: JSON.stringify({ subscriptionId: id }),
      });
      result.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (user.role !== "ADMIN")
    return <Empty title="Operations are available to administrators" />;
  const data = result.data?.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KEEP THINGS RUNNING</span>
          <h1>Operations</h1>
          <p>Billing worker health, retries and payment reconciliation.</p>
        </div>
        <button className="button" onClick={result.reload}>
          Refresh
        </button>
      </div>
      {error && (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      )}
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Failure error={result.error} retry={result.reload} />
      ) : (
        data && (
          <>
            <div
              className={`notice ${data.healthy ? "notice-success" : "notice-error"}`}
              role="status"
            >
              {data.healthy
                ? "Billing worker is running."
                : "No recent billing worker heartbeat. Start the worker process to run scheduled billing."}{" "}
              Last seen:{" "}
              {data.heartbeat
                ? new Date(data.heartbeat.lastSeen).toLocaleString()
                : "Never"}
              .
            </div>
            <section className="panel">
              <div className="panel-heading">
                <h2>Email delivery failures</h2>
              </div>
              {data.deliveryFailures.length ? (
                <div className="form-panel">
                  {data.deliveryFailures.map((row) => (
                    <p key={row.id}>
                      <Link href={`/portal/invoices/${row.invoiceId}`}>
                        Open invoice
                      </Link>{" "}
                      · {row.lastError} · {row.attempts} attempts. Use Send
                      invoice to retry after configuring SMTP.
                    </p>
                  ))}
                </div>
              ) : (
                <Empty title="No email delivery failures" />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Billing failures</h2>
              </div>
              {!data.failures.length ? (
                <Empty
                  title="No billing failures"
                  description="Failed jobs will appear here with a retry control."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Subscription</th>
                        <th>Attempts</th>
                        <th>Failure</th>
                        <th>Retry after</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.failures.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <Link href={`/subscriptions/${row.id}`}>
                              {row.number}
                            </Link>
                          </td>
                          <td>{row.billingFailureCount}</td>
                          <td>{row.billingLastError}</td>
                          <td>{date(row.billingRetryAt)}</td>
                          <td>
                            <button
                              className="button"
                              disabled={busy === row.id}
                              onClick={() => retry(row.id)}
                            >
                              Retry billing
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Pending online checkouts</h2>
              </div>
              {data.pendingCheckouts.length ? (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Reserved amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pendingCheckouts.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <Link href={`/portal/invoices/${row.invoiceId}`}>
                              Open invoice
                            </Link>
                          </td>
                          <td>{money(row.amount)}</td>
                          <td>{row.status.toLowerCase()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="No pending online checkouts" />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Payment exceptions</h2>
              </div>
              {!data.paymentExceptions.length &&
              !data.unexpectedReceipts.length ? (
                <Empty title="No payment exceptions" />
              ) : (
                <div className="form-panel">
                  <p>
                    Review these receipts with your payment provider before
                    recording adjustments.
                  </p>
                  {[...data.paymentExceptions, ...data.unexpectedReceipts].map(
                    (row) => (
                      <p key={row.id}>
                        {row.id} ·{" "}
                        <Link href={`/portal/invoices/${row.invoiceId}`}>
                          Open invoice
                        </Link>
                      </p>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
