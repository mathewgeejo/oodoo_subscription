import { z } from "zod";
import { cadenceSchema, moneySchema } from "../core/contracts";
export const subscriptionDraftSchema = z.object({
  customerId: z.string().min(1).max(100),
  planName: z.string().trim().min(1).max(200),
  cadence: cadenceSchema,
  basePrice: moneySchema,
  baseTaxPercent: moneySchema.refine(value => Number(value) <= 100).default("0"),
  startAt: z.iso.datetime().transform(value => new Date(value)),
  expiresAt: z.iso.datetime().transform(value => new Date(value)),
  paymentTermDays: z.number().int().min(0).max(365).default(14),
  lines: z.array(z.object({
    description: z.string().trim().min(1).max(500), quantity: z.number().int().min(1).max(1000000),
    unitPrice: moneySchema, taxPercent: moneySchema.refine(value => Number(value) <= 100),
  })).min(1).max(100),
}).refine(data => data.expiresAt > data.startAt, { message: "Expiry must follow start", path: ["expiresAt"] });
export const actionSchema = z.object({ action: z.enum(["QUOTE", "CONFIRM", "ACTIVATE", "PAUSE", "RESUME", "CLOSE"]) });
export const catalogDraftSchema = z.object({
  customerId:z.string().min(1).max(100), planId:z.string().min(1), templateId:z.string().min(1).optional(),
  startAt:z.iso.datetime().transform(value=>new Date(value)), expiresAt:z.iso.datetime().transform(value=>new Date(value)),
  paymentTermDays:z.number().int().min(0).max(365).default(14),
  lines:z.array(z.object({productId:z.string().min(1),variantId:z.string().nullable().default(null),quantity:z.number().int().min(1).max(1000000)})).min(1).max(100).optional(),
}).refine(value=>value.expiresAt>value.startAt,{message:"Expiry must follow start",path:["expiresAt"]});
