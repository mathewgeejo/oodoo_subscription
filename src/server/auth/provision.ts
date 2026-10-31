import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { emailSchema, passwordSchema } from "../core/contracts";
import { requirePermission, type Actor } from "../core/permissions";
import { AppError } from "../core/errors";

export const staffInputSchema = z.object({name: z.string().trim().min(1).max(100), email: emailSchema, password: passwordSchema});
export async function provisionUser(input: unknown, actor?: Actor) {
  if (actor) requirePermission(actor, "staff:create");
  const data = staffInputSchema.parse(input);
  const password = await hashPassword(data.password);
  return db.$transaction(async tx => {
    // Bootstrap is CLI-only. No HTTP endpoint may invoke this without an actor.
    if (!actor && await tx.user.count({where: {role: "ADMIN"}})) throw new AppError("ADMIN_EXISTS", "An administrator already exists", 409);
    const id = randomUUID();
    const user = await tx.user.create({data: {id, name: data.name, email: data.email, role: actor ? "STAFF" : "ADMIN"}});
    await tx.account.create({data: {id: randomUUID(), accountId: id, providerId: "credential", userId: id, password}});
    await tx.auditEvent.create({data: {actorId: actor?.id ?? id, action: actor ? "staff.created" : "admin.bootstrapped", resourceId: id}});
    return {id: user.id, name: user.name, email: user.email, role: user.role};
  }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
}
