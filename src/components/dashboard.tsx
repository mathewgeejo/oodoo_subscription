"use client";
import Link from "next/link";
import { useUser } from "./session";
import {
  useData,
  Status,
  Empty,
  Loading,
  Failure,
  type Subscription,
  type Invoice,
  type PageData,
} from "./data";
import { money, date } from "./api";
export function Dashboard() {
  const user = useUser();
  const subs = useData<PageData<Subscription>>(
    "/api/v1/subscriptions?pageSize=5",
  );
  const invoices = useData<PageData<Invoice>>("/api/v1/invoices?pageSize=5");
  const paid = useData<PageData<Invoice>>(
    "/api/v1/invoices?status=PAID&pageSize=1",
  );
  const outstanding = useData<PageData<Invoice>>(
    "/api/v1/invoices?status=CONFIRMED&pageSize=1",
  );
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR BUSINESS, IN VIEW</span>
          <h1>
            Hello, {user.name.split(" ")[0]}{" "}
            <span style={{ fontSize: 23 }}>✳</span>
          </h1>
          <p>Here's what's happening with your subscriptions.</p>
        </div>
        <span className="date-chip">◷ &nbsp; {today}</span>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Total subscriptions",
            value: subs.data?.pagination.total,
            icon: "↻",
            note: "Across your workspace",
          },
          {
            label: "Total invoices",
            value: invoices.data?.pagination.total,
            icon: "▤",
            note: "Every billing cycle, connected",
          },
          {
            label: "Paid invoices",
            value: paid.data?.pagination.total,
            icon: "✓",
            note: "Payments received",
          },
          {
            label: "Awaiting payment",
            value: outstanding.data?.pagination.total,
            icon: "◷",
            note: "Unpaid and partially paid invoices",
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-label">
              {stat.label}
              <span className="stat-icon" aria-hidden="true">
                {stat.icon}
              </span>
            </div>
            <div className="stat-value">
              {stat.value === undefined
                ? "—"
                : stat.value.toLocaleString("en-IN")}
            </div>
            <div className="stat-note">{stat.note}</div>
          </div>
        ))}
      </div>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">LESS BUSYWORK. MORE BRIGHT IDEAS.</span>
          <h2>Keep your business in a good loop.</h2>
          <p>Every plan, invoice, and renewal. A little more connected.</p>
        </div>
        <Link href="/subscriptions" className="button">
          View subscriptions <span>↗</span>
        </Link>
        <span className="banner-orbit" aria-hidden="true">
          ◎
        </span>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent invoices</h2>
            <p>A closer look at your latest billing activity.</p>
          </div>
          <Link className="text-link" href="/invoices">
            View all invoices →
          </Link>
        </div>
        {invoices.loading ? (
          <Loading />
        ) : invoices.error ? (
          <Failure error={invoices.error} retry={invoices.reload} />
        ) : !invoices.data?.data.length ? (
          <Empty
            title="Your first invoice is ahead"
            description="Invoices will appear here once a subscription starts billing."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.data.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/portal/invoices/${invoice.id}`}>
                        <strong>{invoice.number.slice(0, 16)}</strong>
                      </Link>
                    </td>
                    <td>{invoice.customerName}</td>
                    <td>
                      <strong>{money(invoice.total, invoice.currency)}</strong>
                    </td>
                    <td>{date(invoice.dueAt)}</td>
                    <td>
                      <Status value={invoice.status} />
                    </td>
                    <td>
                      <Link
                        href={`/portal/invoices/${invoice.id}`}
                        className="text-link"
                        aria-label={`View invoice ${invoice.number}`}
                      >
                        ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <span>All amounts shown in invoice currency</span>
          <span>Last {invoices.data?.data.length || 0} invoices</span>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Your subscriptions</h2>
            <p>Good things, on repeat.</p>
          </div>
          <Link className="text-link" href="/subscriptions">
            View all →
          </Link>
        </div>
        {subs.loading ? (
          <Loading />
        ) : subs.error ? (
          <Failure error={subs.error} retry={subs.reload} />
        ) : !subs.data?.data.length ? (
          <Empty
            title="Room for something recurring"
            description="Your subscriptions will appear here after they're created."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Subscription</th>
                  <th>Cadence</th>
                  <th>Base price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.data.data.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <Link href={`/subscriptions/${sub.id}`}>
                        <strong>{sub.planName}</strong>
                      </Link>
                    </td>
                    <td>{sub.number.slice(0, 16)}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {sub.cadence.toLowerCase()}
                    </td>
                    <td>{money(sub.basePrice, sub.currency)}</td>
                    <td>
                      <Status value={sub.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
