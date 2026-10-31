import type {Prisma} from "@prisma/client";
import {amount,rounded,type InvoiceInputLine} from "../billing/money";
export async function chooseDiscount(tx:Prisma.TransactionClient,lines:InvoiceInputLine[],at:Date){
  // Lock in stable order so capped rules cannot be consumed by two invoices.
  await tx.$queryRaw`SELECT "id" FROM "DiscountRule" WHERE "active" = true AND "startsAt" <= ${at} AND "endsAt" > ${at} AND "usageCount" < "usageLimit" ORDER BY "id" FOR UPDATE`;
  const rules=await tx.discountRule.findMany({where:{active:true,startsAt:{lte:at},endsAt:{gt:at}},include:{targets:true},orderBy:{id:"asc"}});
  let best:{id:string;saving:string;eligibleIndexes:number[]}|null=null;
  for(const rule of rules){
    if(rule.usageCount>=rule.usageLimit) continue;
    const targets=new Set(rule.targets.map(target=>target.productId));
    const eligibleIndexes=lines.flatMap((line,index)=>!targets.size || (line.productId && targets.has(line.productId))?[index]:[]);
    const subtotal=eligibleIndexes.reduce((sum,index)=>sum.plus(amount(lines[index].unitPrice).mul(lines[index].quantity)),amount("0"));
    const quantity=eligibleIndexes.reduce((sum,index)=>sum+lines[index].quantity,0);
    if(subtotal.lt(rule.minimumPurchase.toFixed(2)) || quantity<rule.minimumQuantity) continue;
    const saving=rounded(rule.kind==="FIXED"?amount(rule.value.toFixed(2)):subtotal.mul(rule.value.toFixed(2)).div(100));
    const capped=saving.gt(subtotal)?subtotal:saving;
    if(capped.gt(best?.saving??"0")) best={id:rule.id,saving:capped.toFixed(2),eligibleIndexes};
  }
  return best;
}
