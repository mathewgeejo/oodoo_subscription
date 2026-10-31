import type {Prisma} from "@prisma/client";
import {catalogDraftSchema} from "../subscriptions/contracts";
import {AppError} from "../core/errors";
import {amount} from "../billing/money";
export async function catalogQuotation(tx:Prisma.TransactionClient,input:unknown,now=new Date()){
  const data=catalogDraftSchema.parse(input);
  const plan=await tx.plan.findUnique({where:{id:data.planId},include:{taxRule:true}});
  if(!plan || !plan.active || (plan.availableFrom && plan.availableFrom>now) || (plan.availableUntil && plan.availableUntil<=now)) throw new AppError("UNAVAILABLE_PLAN","Choose a currently available plan",422);
  const template=data.templateId ? await tx.quotationTemplate.findUnique({where:{id:data.templateId},include:{lines:true}}):null;
  if(data.templateId && (!template || !template.active || template.planId!==plan.id)) throw new AppError("INVALID_TEMPLATE","Template must belong to the selected plan",422);
  const requested=data.lines ?? template?.lines;
  if(!requested?.length) throw new AppError("MISSING_LINES","Add at least one product",422);
  if(requested.reduce((sum,line)=>sum+line.quantity,0)<plan.minimumQuantity) throw new AppError("MINIMUM_QUANTITY",`This plan requires at least ${plan.minimumQuantity} items`,422);
  const lines=[];
  for(const item of requested){
    const product=await tx.product.findUnique({where:{id:item.productId},include:{taxRule:true}});
    const variant=item.variantId ? await tx.productVariant.findUnique({where:{id:item.variantId}}):null;
    if(!product?.active || (item.variantId && (!variant?.active || variant.productId!==product.id))) throw new AppError("UNAVAILABLE_PRODUCT","Choose an active product and matching variant",422);
    const price=amount(product.salesPrice.toFixed(2)).plus(variant?.priceAdjustment.toFixed(2)??"0");
    lines.push({productId:product.id,variantId:variant?.id??null,description:product.name+(variant?` · ${variant.name}`:""),quantity:item.quantity,unitPrice:price.toFixed(2),taxPercent:product.taxRule?.active ? product.taxRule.percent.toFixed(2):"0"});
  }
  return {customerId:data.customerId,planId:plan.id,templateId:template?.id??null,quotationValidityDays:template?.validityDays??14,planName:plan.name,cadence:plan.cadence,basePrice:plan.basePrice,baseTaxPercent:plan.taxRule?.active ? plan.taxRule.percent:plan.baseTaxPercent,minimumQuantity:plan.minimumQuantity,canPause:plan.canPause,canRenew:plan.canRenew,canCloseEarly:plan.canCloseEarly,autoClose:plan.autoClose,startAt:data.startAt,expiresAt:data.expiresAt,paymentTermDays:data.paymentTermDays,lines};
}
