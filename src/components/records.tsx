"use client";
import Link from "next/link";
import { useState } from "react";
import {
  useData,
  Status,
  Empty,
  Loading,
  Failure,
  type Invoice,
  type Subscription,
  type PageData,
} from "./data";
import { money, date } from "./api";
export function Records({ kind }: { kind: "invoices" | "subscriptions" }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const result = useData<PageData<Invoice | Subscription>>(
    `/api/v1/${kind}?page=${page}&pageSize=15${kind === "invoices" && status ? `&status=${status}` : ""}`,
  );
  const rows =
    result.data?.data.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KEEP EVERYTHING CONNECTED</span>
          <h1>{kind === "invoices" ? "Invoices" : "Subscriptions"}</h1>
          <p>
            {kind === "invoices"
              ? "A clear view of your billing, from issued to paid."
              : "The plans and relationships that keep your business moving."}
          </p>
        </div>
        <span className="date-chip">
          {result.data?.pagination.total ?? "—"} {kind}
        </span>
      </div>
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label={`Search displayed ${kind}`}
            placeholder={`Search displayed ${kind}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {kind === "invoices" && (
            <select
              aria-label="Invoice status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {["DRAFT", "CONFIRMED", "PAID", "CANCELLED"].map((value) => (
                <option value={value} key={value}>
                  {value[0] + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <Failure error={result.error} retry={result.reload} />
        ) : !rows.length ? (
          <Empty
            title={search ? "No matching records" : "A fresh start"}
            description={
              search
                ? "Try another search, or go to another page."
                : `Your ${kind} will appear here when they're created.`
            }
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{kind === "invoices" ? "Invoice" : "Plan"}</th>
                  <th>{kind === "invoices" ? "Customer" : "Subscription"}</th>
                  <th>{kind === "invoices" ? "Amount" : "Base price"}</th>
                  <th>{kind === "invoices" ? "Balance" : "Cadence"}</th>
                  <th>{kind === "invoices" ? "Due date" : "Expiry"}</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const inv = row as Invoice;
                  const sub = row as Subscription;
                  const href =
                    kind === "invoices"
                      ? `/portal/invoices/${row.id}`
                      : `/subscriptions/${row.id}`;
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link href={href}>
                          <strong>
                            {kind === "invoices"
                              ? inv.number.slice(0, 20)
                              : sub.planName}
                          </strong>
                        </Link>
                      </td>
                      <td>
                        {kind === "invoices"
                          ? inv.customerName
                          : sub.number.slice(0, 16)}
                      </td>
                      <td>
                        {money(
                          kind === "invoices" ? inv.total : sub.basePrice,
                          row.currency,
                        )}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {kind === "invoices"
                          ? money(inv.balance, inv.currency)
                          : sub.cadence.toLowerCase()}
                      </td>
                      <td>
                        {date(kind === "invoices" ? inv.dueAt : sub.expiresAt)}
                      </td>
                      <td>
                        <Status value={row.status} />
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={href}
                          aria-label={`Open ${row.number}`}
                        >
                          ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <span>
            {result.data?.pagination.total || 0} records · Page {page}
          </span>
          <div className="actions">
            <button
              className="button"
              disabled={page === 1 || result.loading}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Previous
            </button>
            <button
              className="button"
              disabled={
                !result.data ||
                page * 15 >= result.data.pagination.total ||
                result.loading
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
