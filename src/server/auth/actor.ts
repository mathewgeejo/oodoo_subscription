import { getAuth } from "./config";
import { roleSchema } from "../core/contracts";
import { AppError } from "../core/errors";
import type { Actor } from "../core/permissions";
import { configuredTrustedOrigins } from "./origins";

export async function requireActor(request: Request): Promise<Actor> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new AppError("UNAUTHORIZED", "Sign in to continue", 401);
  return { id: session.user.id, role: roleSchema.parse(session.user.role) };
}
/** Keep business mutations and Better Auth on the same exact-origin policy. */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!process.env.BETTER_AUTH_URL || !origin || !configuredTrustedOrigins().includes(origin)) throw new AppError("FORBIDDEN", "Invalid request origin", 403);
}
