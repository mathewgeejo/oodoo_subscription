type OriginOptions = { environment?: string; extraOrigins?: string };

/** Exact origins only. Loopback host aliases are interchangeable on the same
 * protocol/port in development; arbitrary hosts and other ports stay blocked. */
export function trustedOriginsFor(baseURL: string, options: OriginOptions = {}) {
  const base = new URL(baseURL);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.hostname.includes("*")) throw new Error("Authentication URL must use an exact HTTP(S) host without credentials");
  const origins = new Set([base.origin]);
  if (options.environment === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const alias = new URL(base.origin);
      alias.hostname = host;
      origins.add(alias.origin);
    }
  }
  for (const value of (options.extraOrigins ?? "").split(",").map(item => item.trim()).filter(Boolean)) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname.includes("*") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Trusted origins must be exact HTTP(S) origins without credentials or paths");
    origins.add(url.origin);
  }
  return [...origins];
}
export function configuredTrustedOrigins() {
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!baseURL) throw new Error("Configure BETTER_AUTH_URL");
  return trustedOriginsFor(baseURL, {environment: process.env.NODE_ENV, extraOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS});
}
