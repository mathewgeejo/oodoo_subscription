export class ApiError extends Error {constructor(message: string, public status: number) {super(message);}}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {...options, headers: {"content-type": "application/json", ...options?.headers}});
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const fields = body?.error?.fields;
    const details = fields ? Object.values(fields).flat().filter(Boolean).join(". ") : "";
    throw new ApiError(details || body?.error?.message || body?.message || "Something went wrong. Please try again.", response.status);
  }
  return body as T;
}
export function money(value: string, currency = "INR") {
  const [integer, fraction = ""] = value.split(".");
  const grouped = new Intl.NumberFormat("en-IN").format(BigInt(integer));
  return `${currency === "INR" ? "₹" : currency + " "}${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export function date(value: string) {return new Intl.DateTimeFormat("en-IN", {day:"numeric", month:"short", year:"numeric"}).format(new Date(value));}
