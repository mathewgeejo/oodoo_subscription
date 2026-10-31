import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {createDraft,actOnSubscription} from "../../src/server/subscriptions/service";
import {billSubscription} from "../../src/server/billing/service";
import {queueInvoice,runNotificationBatch} from "../../src/server/notifications/service";
if(!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Use dedicated *_test database");
after(()=>db.$disconnect());
test("invoice outbox is atomic, idempotent, leased and skips demo recipients",async()=>{
 const actor={id:"notification-staff",role:"ADMIN" as const};const at=new Date();
 const customer=await db.user.create({data:{id:randomUUID(),name:"Notification test",email:`${randomUUID()}@notifications.local`}});
 const sub=await createDraft(actor,{customerId:customer.id,planName:"Notify",cadence:"MONTHLY",basePrice:"100",startAt:at.toISOString(),expiresAt:new Date(at.getTime()+60*86400000).toISOString(),lines:[{description:"Seat",quantity:1,unitPrice:"10",taxPercent:"0"}]});
 for(const action of ["QUOTE","CONFIRM","ACTIVATE"] as const)await actOnSubscription(actor,sub.id,action,at);
 const invoice=(await billSubscription(sub.id,at))!;
 assert.equal(await db.notificationJob.count({where:{invoiceId:invoice.id}}),1);
 const first=await queueInvoice(actor,invoice.id);const second=await queueInvoice(actor,invoice.id);assert.equal(first.id,second.id);
 let delivered=0;const previous=process.env.BETTER_AUTH_URL;process.env.BETTER_AUTH_URL="https://billing.example.test";
 try{
  const send=async(message:{to:string;text:string})=>{assert.equal(message.to,customer.email);assert.ok(message.text.includes(invoice.id));delivered++};
  await Promise.all([runNotificationBatch(new Date(),1000,send),runNotificationBatch(new Date(),1000,send)]);
  assert.equal(delivered,1);assert.equal((await db.notificationJob.findUniqueOrThrow({where:{id:first.id}})).status,"SENT");
  await assert.rejects(()=>queueInvoice({id:customer.id,role:"CUSTOMER"},invoice.id));
 }finally{if(previous===undefined)delete process.env.BETTER_AUTH_URL;else process.env.BETTER_AUTH_URL=previous;await db.invoice.update({where:{id:invoice.id},data:{customerEmail:`${randomUUID()}@example.test`}})}
});
