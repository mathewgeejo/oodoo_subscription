import {config} from "dotenv";
import {hashPassword} from "better-auth/crypto";
import {createHash} from "node:crypto";
import {db} from "../src/server/db";
import {emailSchema,passwordSchema} from "../src/server/core/contracts";
import {calculateInvoice,amount} from "../src/server/billing/money";
import {periodBoundary} from "../src/server/billing/calendar";
config({path:[".env.local",".env"],quiet:true});

/** Additive, repeatable fixtures: stable demo IDs, no truncate, no updates to existing records. */
async function main(){
  const database=new URL(process.env.DATABASE_URL??"").pathname;
  if(!database.endsWith("_demo") && process.env.ALLOW_DEMO_SEED!=="true") throw new Error("Use a *_demo database or explicitly set ALLOW_DEMO_SEED=true");
  const customerEmail=process.env.DEMO_CUSTOMER_EMAIL ? emailSchema.parse(process.env.DEMO_CUSTOMER_EMAIL):undefined;
  const portalCustomer=customerEmail ? await db.user.findUnique({where:{email:customerEmail}}):null;
  if(customerEmail && (!portalCustomer || portalCustomer.role!=="CUSTOMER")) throw new Error("DEMO_CUSTOMER_EMAIL must identify an existing customer account");
  const password=await hashPassword(passwordSchema.parse(process.env.DEMO_SEED_PASSWORD));
  const now=new Date();
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5,1,3,30));
  const until=periodBoundary(start,"MONTHLY",18,"Asia/Kolkata");
  const names=["Northstar Studio","Juniper Labs","Paper Plane Co.","Evergreen Digital","Copper & Clay","Atlas Learning","Sunday Market","Orbit Systems","Willow Creative","Cedar Works","Lighthouse Media","Maple Collective"];
  const users=[{id:"demo-admin",name:"Demo Administrator",email:"admin@brightloop.example",role:"ADMIN" as const},{id:"demo-staff",name:"Demo Billing",email:"billing@brightloop.example",role:"STAFF" as const},...names.map((name,index)=>({id:`demo-customer-${index+1}`,name,email:`${index===0?"northstar":`customer${index+1}`}@brightloop.example`,role:"CUSTOMER" as const}))];
  for(const user of users){
    const existing=await db.user.findUnique({where:{email:user.email}});
    if(existing && existing.id!==user.id) throw new Error(`Demo email already belongs to another account: ${user.email}`);
    await db.user.upsert({where:{id:user.id},create:user,update:{}});
    await db.account.upsert({where:{providerId_accountId:{providerId:"credential",accountId:user.id}},create:{id:`${user.id}-credential`,providerId:"credential",accountId:user.id,userId:user.id,password},update:{}});
  }
  await db.taxRule.upsert({where:{id:"demo-tax-18"},create:{id:"demo-tax-18",name:"Standard tax 18%",percent:"18"},update:{}});
  const products=[{id:"demo-product-seats",name:"Workspace seats",salesPrice:"300",costPrice:"100",type:"SERVICE" as const},{id:"demo-product-support",name:"Priority support",salesPrice:"900",costPrice:"350",type:"SERVICE" as const},{id:"demo-product-storage",name:"Cloud storage add-on",salesPrice:"150",costPrice:"50",type:"DIGITAL" as const}];
  for(const product of products) await db.product.upsert({where:{id:product.id},create:{...product,taxRuleId:"demo-tax-18",notes:"Synthetic demonstration product"},update:{}});
  await db.productVariant.upsert({where:{id:"demo-variant-odoo"},create:{id:"demo-variant-odoo",productId:products[0].id,name:"Odoo",priceAdjustment:"560"},update:{}});
  const plans=[{id:"demo-plan-starter",name:"Starter",basePrice:"990",cadence:"MONTHLY" as const},{id:"demo-plan-growth",name:"Growth",basePrice:"2490",cadence:"MONTHLY" as const},{id:"demo-plan-annual",name:"Annual partner",basePrice:"24900",cadence:"YEARLY" as const}];
  for(const plan of plans) await db.plan.upsert({where:{id:plan.id},create:{...plan,taxRuleId:"demo-tax-18",minimumQuantity:1,canPause:true,canRenew:true,canCloseEarly:true},update:{}});
  await db.quotationTemplate.upsert({where:{id:"demo-template-growth"},create:{id:"demo-template-growth",name:"Growth with Odoo",planId:plans[1].id,validityDays:14,lines:{create:[{productId:products[0].id,variantId:"demo-variant-odoo",quantity:3},{productId:products[1].id,quantity:1}]}},update:{}});
  // Inactive offer demonstrates configuration without changing newly created invoices.
  await db.discountRule.upsert({where:{id:"demo-discount-welcome"},create:{id:"demo-discount-welcome",name:"Welcome offer",kind:"PERCENTAGE",value:"10",minimumPurchase:"1000",minimumQuantity:1,startsAt:start,endsAt:until,usageLimit:100,active:false,targets:{create:{productId:products[0].id}}},update:{}});
  for(let index=0;index<18;index++){
    const plan=plans[index%2]; const customer=users[2+index%12];
    const id=`demo-subscription-${index+1}`;
    const status=index===15?"DRAFT":index===16?"QUOTATION":index===17?"CONFIRMED":index===13?"PAUSED":index===14?"CLOSED":"ACTIVE";
    const unitPrice=index%3===0?"860":"300";
    const line={description:`Workspace seats${index%3===0?" · Odoo":""}`,quantity:2+index%4,unitPrice,taxPercent:"18",productId:products[0].id,variantId:index%3===0?"demo-variant-odoo":null};
    await db.subscription.upsert({where:{id},create:{id,number:`SUB-DEMO-${String(index+1).padStart(3,"0")}`,customerId:customer.id,planId:plan.id,planName:plan.name,cadence:plan.cadence,basePrice:plan.basePrice,baseTaxPercent:"18",minimumQuantity:1,canPause:true,canRenew:true,canCloseEarly:true,status,startAt:start,expiresAt:until,paymentTermDays:14,nextPeriodIndex:6,nextBillingAt:status==="ACTIVE"?periodBoundary(start,"MONTHLY",6,"Asia/Kolkata"):null,quotationExpiresAt:status==="QUOTATION"?new Date(now.getTime()+14*86400000):null,lines:{create:line}},update:{}});
    if(index>=15) continue;
    for(let period=0;period<6;period++){
      const periodStart=periodBoundary(start,"MONTHLY",period,"Asia/Kolkata");
      const periodEnd=periodBoundary(start,"MONTHLY",period+1,"Asia/Kolkata");
      const totals=calculateInvoice([{description:`${plan.name} base`,quantity:1,unitPrice:plan.basePrice,taxPercent:"18"},line]);
      const invoiceId=`demo-invoice-${index+1}-${period}`;
      const paid=period<3 || (period===3 && index%2===0);
      const cancelled=period===4 && index%5===0;
      const draft=period===5 && index%7===0;
      const invoice=await db.invoice.upsert({where:{id:invoiceId},create:{id:invoiceId,number:`INV-DEMO-${String(index+1).padStart(3,"0")}-${period+1}`,subscriptionId:id,periodIndex:period,periodStart,periodEnd,dueAt:new Date(periodStart.getTime()+14*86400000),status:cancelled?"CANCELLED":draft?"DRAFT":paid?"PAID":"CONFIRMED",currency:"INR",customerName:customer.name,customerEmail:customer.email,subtotal:totals.subtotal,discount:totals.discount,tax:totals.tax,total:totals.total,createdAt:periodStart,lines:{create:totals.lines}},update:{}});
      const partial=!paid && !cancelled && !draft && period===4;
      if(paid||partial) await db.payment.upsert({where:{reference:`demo-payment-${index+1}-${period}`},create:{invoiceId:invoice.id,reference:`demo-payment-${index+1}-${period}`,amount:partial?amount(totals.total).div(2).toFixed(2):totals.total,method:index%2?"BANK_TRANSFER":"CASH",paidAt:new Date(periodStart.getTime()+5*86400000),recordedBy:"demo-staff",note:"Synthetic demo payment; no funds transferred"},update:{}});
    }
  }
  if(portalCustomer){
    const key=createHash("sha256").update(portalCustomer.id).digest("hex").slice(0,12);
    const statuses=["ACTIVE","ACTIVE","PAUSED","CLOSED","DRAFT","QUOTATION","CONFIRMED"] as const;
    for(const [index,status] of statuses.entries()){
      const plan=plans[index%2];
      const id=`demo-portal-${key}-${index+1}`;
      const lines=[{description:"Workspace seats · Odoo",quantity:2+index,unitPrice:"860",taxPercent:"18",productId:products[0].id,variantId:"demo-variant-odoo"},...(index%2?[{description:"Priority support",quantity:1,unitPrice:"900",taxPercent:"18",productId:products[1].id,variantId:null}]:[])];
      await db.subscription.upsert({where:{id},create:{id,number:`SUB-DEMO-${key}-${index+1}`,customerId:portalCustomer.id,planId:plan.id,planName:plan.name,cadence:plan.cadence,basePrice:plan.basePrice,baseTaxPercent:"18",minimumQuantity:1,canPause:true,canRenew:true,canCloseEarly:true,status,startAt:start,expiresAt:until,paymentTermDays:14,nextPeriodIndex:index<4?6:0,nextBillingAt:status==="ACTIVE"?periodBoundary(start,"MONTHLY",6,"Asia/Kolkata"):null,quotationExpiresAt:status==="QUOTATION"?new Date(now.getTime()+14*86400000):null,lines:{create:lines}},update:{}});
      if(index>=4)continue;
      for(let period=0;period<6;period++){
        const periodStart=periodBoundary(start,"MONTHLY",period,"Asia/Kolkata");
        const periodEnd=periodBoundary(start,"MONTHLY",period+1,"Asia/Kolkata");
        const totals=calculateInvoice([{description:`${plan.name} base`,quantity:1,unitPrice:plan.basePrice,taxPercent:"18"},...lines]);
        const paid=period<3;
        const partial=period===3;
        const cancelled=period===4&&status==="CLOSED";
        const invoiceId=`demo-portal-invoice-${key}-${index+1}-${period}`;
        await db.invoice.upsert({where:{id:invoiceId},create:{id:invoiceId,number:`INV-DEMO-${key}-${index+1}-${period+1}`,subscriptionId:id,periodIndex:period,periodStart,periodEnd,dueAt:new Date(periodStart.getTime()+14*86400000),status:cancelled?"CANCELLED":paid?"PAID":"CONFIRMED",currency:"INR",customerName:portalCustomer.name,customerEmail:`portal-${key}@brightloop.example`,subtotal:totals.subtotal,discount:totals.discount,tax:totals.tax,total:totals.total,createdAt:periodStart,lines:{create:totals.lines}},update:{}});
        if(paid||partial)await db.payment.upsert({where:{reference:`demo-portal-payment-${key}-${index+1}-${period}`},create:{invoiceId,reference:`demo-portal-payment-${key}-${index+1}-${period}`,amount:partial?amount(totals.total).div(2).toFixed(2):totals.total,method:index%2?"BANK_TRANSFER":"CASH",paidAt:new Date(periodStart.getTime()+5*86400000),recordedBy:"demo-staff",note:"Synthetic portal demo payment; no funds transferred"},update:{}});
      }
    }
    console.log("Customer portal populated: 7 subscriptions and 24 invoices linked to the selected account. Existing records and account permissions retained.");
  }
  console.log("Demo data ready: 14 accounts, 18 subscriptions, 90 invoices, products, plans and template. Existing records retained.");
  console.log("Accounts: admin@brightloop.example, billing@brightloop.example, northstar@brightloop.example. Password: supplied DEMO_SEED_PASSWORD (unchanged on rerun).");
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Demo seed failed");process.exitCode=1;}).finally(()=>db.$disconnect());
