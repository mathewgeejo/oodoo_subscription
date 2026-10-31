import { z } from "zod";
import { moneySchema, cadenceSchema } from "../core/contracts";
const name = z.string().trim().min(1).max(200);
const tax = moneySchema.refine(value => Number(value) <= 100, "Tax must be between zero and 100");
export const productSchema = z.object({
  name, type: z.enum(["SERVICE", "DIGITAL", "PHYSICAL"]), salesPrice: moneySchema, costPrice: moneySchema,
  notes: z.string().trim().max(5000).default(""), active: z.boolean().default(true),
  taxRuleId: z.string().min(1).nullable().default(null),
  variants: z.array(z.object({name, priceAdjustment: moneySchema})).max(100).default([]),
}).refine(value => new Set(value.variants.map(variant => variant.name)).size === value.variants.length, {message: "Variant names must be unique", path: ["variants"]});
export const planSchema = z.object({
  name, basePrice: moneySchema, baseTaxPercent: tax.default("0"), cadence: cadenceSchema,
  taxRuleId: z.string().min(1).nullable().default(null),
  minimumQuantity: z.number().int().min(1).max(1000000).default(1),
  availableFrom: z.iso.datetime().transform(value => new Date(value)).nullable().default(null),
  availableUntil: z.iso.datetime().transform(value => new Date(value)).nullable().default(null),
  canPause: z.boolean().default(false), canRenew: z.boolean().default(true),
  canCloseEarly: z.boolean().default(false), autoClose: z.boolean().default(true), active: z.boolean().default(true),
}).refine(value => !value.availableFrom || !value.availableUntil || value.availableUntil > value.availableFrom, {message: "Availability end must follow start", path: ["availableUntil"]});
export const templateSchema = z.object({name, planId: z.string().min(1), validityDays: z.number().int().min(1).max(365), active: z.boolean().default(true), lines: z.array(z.object({productId: z.string().min(1), variantId: z.string().nullable().default(null), quantity: z.number().int().min(1).max(1000000), taxPercent: tax.default("0")})).min(1).max(100)});
export const taxRuleSchema = z.object({name, percent: tax, active: z.boolean().default(true)});
export const discountRuleSchema = z.object({
  name, kind: z.enum(["FIXED", "PERCENTAGE"]), value: moneySchema,
  minimumPurchase: moneySchema.default("0"), minimumQuantity: z.number().int().min(1).max(1000000).default(1),
  startsAt: z.iso.datetime().transform(value => new Date(value)), endsAt: z.iso.datetime().transform(value => new Date(value)),
  usageLimit: z.number().int().min(1).max(100000000), productIds: z.array(z.string().min(1)).max(1000).default([]), active: z.boolean().default(true),
}).refine(value => value.endsAt > value.startsAt, {message: "Discount end must follow start", path: ["endsAt"]})
  .refine(value => value.kind !== "PERCENTAGE" || Number(value.value) <= 100, {message: "Percentage cannot exceed 100", path: ["value"]});
