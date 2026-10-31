"use client";
import { useState, type FormEvent } from "react";
import { useUser } from "./session";
import { useData, Loading, Failure, Empty, type PageData } from "./data";
import { api, date } from "./api";
type Customer = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: { subscriptions: number };
};
export function Customers() {
  const user = useUser();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const result = useData<PageData<Customer>>(
    `/api/v1/customers?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/customers", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data)),
      });
      setCreate(false);
      result.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user.role === "CUSTOMER")
    return <Empty title="Customers are managed by your billing team" />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PEOPLE BEHIND THE PLANS</span>
          <h1>Customers</h1>
          <p>Your customer accounts and their subscriptions.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setCreate(!create)}
        >
          Add customer
        </button>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {create && (
        <section className="panel">
          <form className="form-panel" onSubmit={save}>
            <h2>New customer</h2>
            <div className="form-grid">
              <label>
                Name
                <input name="name" required maxLength={100} />
              </label>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Temporary password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={9}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <small>
                  Use uppercase, lowercase and a special character. Share it
                  with the customer securely; they can change it in My account.
                </small>
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Creating…" : "Create customer"}
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Search customers"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <Failure error={result.error} retry={result.reload} />
        ) : !result.data?.data.length ? (
          <Empty title="No customers found" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Subscriptions</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.email}</td>
                    <td>{row._count.subscriptions}</td>
                    <td>{date(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <span>{result.data?.pagination.total ?? 0} customers</span>
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
