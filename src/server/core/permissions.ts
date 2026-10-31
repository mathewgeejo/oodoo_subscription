import type { Role } from "./contracts";
import { AppError } from "./errors";

export type Actor = { id: string; role: Role };
export type Permission = "configuration:write" | "staff:create" | "business:write" | "reports:read";
const grants: Record<Permission, readonly Role[]> = {
  "configuration:write": ["ADMIN"], "staff:create": ["ADMIN"],
  "business:write": ["ADMIN", "STAFF"], "reports:read": ["ADMIN", "STAFF"],
};
export function requirePermission(actor: Actor, permission: Permission) {
  if (!grants[permission].includes(actor.role)) throw new AppError("FORBIDDEN", "Access denied", 403);
}
export function requireOwnerOrStaff(actor: Actor, customerUserId: string) {
  if (actor.role === "CUSTOMER" && actor.id !== customerUserId) throw new AppError("NOT_FOUND", "Resource not found", 404);
}
