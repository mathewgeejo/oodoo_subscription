import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { requirePermission, type Actor } from "../core/permissions";
import { AppError } from "../core/errors";
import { paginationSchema } from "../core/contracts";
import { productSchema, planSchema, templateSchema, taxRuleSchema, discountRuleSchema } from "./contracts";
export const resourceSchema = z.enum(["products", "plans", "templates", "taxes", "discounts"]);
export type CatalogResource = z.infer<typeof resourceSchema>;

export async function listCatalog(actor: Actor, resource: CatalogResource, input: unknown) {
  requirePermission(actor, "business:write");
  const {page, pageSize, search} = paginationSchema.extend({search: z.string().trim().max(200).default("")}).parse(input);
  const where = search ? {name: {contains: search, mode: "insensitive" as const}} : {};
  const options = {where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{name: "asc" as const}, {id: "asc" as const}]};
  const result = await db.$transaction(async tx => {
    switch (resource) {
      case "products": return {data: await tx.product.findMany({...options, include: {variants: {where: {active: true}}}}), total: await tx.product.count({where})};
      case "plans": return {data: await tx.plan.findMany(options), total: await tx.plan.count({where})};
      case "templates": return {data: await tx.quotationTemplate.findMany({...options, include:{lines:true}}), total: await tx.quotationTemplate.count({where})};
      case "taxes": return {data: await tx.taxRule.findMany(options), total: await tx.taxRule.count({where})};
      case "discounts": return {data: (await tx.discountRule.findMany({...options,include:{targets:true}})).map(rule=>({...rule,productIds:rule.targets.map(target=>target.productId)})), total: await tx.discountRule.count({where})};
    }
  });
  const data = resource === "products" && actor.role !== "ADMIN" ? result.data.map(row => {const {costPrice: _cost, ...safe} = row as unknown as Record<string, unknown>; return safe;}) : result.data;
  return {data, pagination: {page, pageSize, total: result.total}};
}
async function validateTemplate(tx: Prisma.TransactionClient, data: z.infer<typeof templateSchema>) {
  if (!await tx.plan.findFirst({where: {id: data.planId, active: true}})) throw new AppError("INVALID_PLAN", "Choose an active plan", 422);
  for (const line of data.lines) {
    if (!await tx.product.findFirst({where: {id: line.productId, active: true}})) throw new AppError("INVALID_PRODUCT", "Template references an unavailable product", 422);
    if (line.variantId && !await tx.productVariant.findFirst({where: {id: line.variantId, productId: line.productId, active: true}})) throw new AppError("INVALID_VARIANT", "Variant does not belong to the selected product", 422);
  }
}
export async function saveCatalog(actor: Actor, resource: CatalogResource, input: unknown, id?: string) {
  requirePermission(actor, "configuration:write");
  return db.$transaction(async tx => {
    let result: {id: string};
    if (resource === "products") {
      const {variants, ...data} = productSchema.parse(input);
      if(data.taxRuleId && !await tx.taxRule.findFirst({where:{id:data.taxRuleId,active:true}})) throw new AppError("INVALID_TAX","Choose an active tax rule",422);
      const product = id ? await tx.product.update({where: {id}, data}) : await tx.product.create({data});
      await tx.productVariant.updateMany({where: {productId: product.id}, data: {active: false}});
      for (const variant of variants) await tx.productVariant.upsert({where: {productId_name: {productId: product.id, name: variant.name}}, create: {...variant, productId: product.id}, update: {...variant, active: true}});
      result = await tx.product.findUniqueOrThrow({where: {id: product.id}, include: {variants: {where: {active: true}}}});
    } else if (resource === "plans") {
      const data = planSchema.parse(input);
      if(data.taxRuleId && !await tx.taxRule.findFirst({where:{id:data.taxRuleId,active:true}})) throw new AppError("INVALID_TAX","Choose an active tax rule",422);
      result = id ? await tx.plan.update({where: {id}, data}) : await tx.plan.create({data});
    } else if (resource === "templates") {
      const data = templateSchema.parse(input);
      await validateTemplate(tx, data);
      const {lines,...values}=data;
      const lineValues=lines.map(({productId,variantId,quantity})=>({productId,variantId,quantity}));
      result = id ? await tx.quotationTemplate.update({where: {id}, data:{...values,lines:{deleteMany:{},create:lineValues}},include:{lines:true}}) : await tx.quotationTemplate.create({data:{...values,lines:{create:lineValues}},include:{lines:true}});
    } else if (resource === "taxes") {
      const data = taxRuleSchema.parse(input);
      result = id ? await tx.taxRule.update({where: {id}, data}) : await tx.taxRule.create({data});
    } else {
      const data = discountRuleSchema.parse(input);
      data.productIds = [...new Set(data.productIds)];
      if (await tx.product.count({where: {id: {in: data.productIds}, active: true}}) !== data.productIds.length) throw new AppError("INVALID_PRODUCTS", "Discount references an unavailable product", 422);
      if (id) {
        const current = await tx.discountRule.findUnique({where: {id}});
        if (current && current.usageCount > data.usageLimit) throw new AppError("USAGE_LIMIT", "Usage limit cannot be lower than usage already consumed", 409);
      }
      const {productIds,...values}=data;
      result = id ? await tx.discountRule.update({where: {id}, data:{...values,targets:{deleteMany:{},create:productIds.map(productId=>({productId}))}}}) : await tx.discountRule.create({data:{...values,targets:{create:productIds.map(productId=>({productId}))}}});
    }
    await tx.auditEvent.create({data: {actorId: actor.id, action: `catalog.${resource}.${id ? "updated" : "created"}`, resourceId: result.id}});
    return result;
  });
}
