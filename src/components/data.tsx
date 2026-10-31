"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
export type Subscription = {
  id: string;
  number: string;
  planName: string;
  status: string;
  cadence: string;
  basePrice: string;
  currency: string;
  startAt: string;
  expiresAt: string;
  canPause: boolean;
  canRenew: boolean;
  canCloseEarly: boolean;
  pendingAction: string | null;
};
export type Invoice = {
  id: string;
  number: string;
  subscriptionId: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: string;
  balance: string;
  currency: string;
  dueAt: string;
  createdAt: string;
};
export type PageData<T> = {
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
};
export function useData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<T>(url, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`badge status-${value.toLowerCase()}`}>
      {value.toLowerCase()}
    </span>
  );
}
export function Empty({
  title = "Nothing here just yet",
  description = "Your records will appear here when they're ready.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        ◫
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div style={{ padding: 24 }} role="status" aria-label="Loading records">
      {[1, 2, 3].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <div className="notice notice-error" role="alert">
      {error}{" "}
      <button className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
