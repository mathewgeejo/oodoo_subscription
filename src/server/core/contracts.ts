import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "STAFF", "CUSTOMER"]);
export type Role = z.infer<typeof roleSchema>;
export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(9).max(128)
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[^A-Za-z0-9\s]/, "Include a special character");
export const moneySchema = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/, "Use a non-negative decimal amount with at most two decimals");
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const cadenceSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export type Cadence = z.infer<typeof cadenceSchema>;
