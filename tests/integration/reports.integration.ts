import {test,after} from "node:test";
import assert from "node:assert/strict";
import {db} from "../../src/server/db";
import {businessReport} from "../../src/server/reports/service";
import {amount} from "../../src/server/billing/money";
if(!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Use dedicated *_test database");
after(()=>db.$disconnect());
test("report totals reconcile to invoices and payment dates with customer access denied",async()=>{
 const actor={id:"report-staff",role:"STAFF" as const};
 const range={from:"2026-01-01T00:00:00Z",to:"2027-01-01T00:00:00Z"};
 const report=await businessReport(actor,range);
 const invoices=await db.invoice.aggregate({where:{createdAt:{gte:new Date(range.from),lt:new Date(range.to)},status:{in:["CONFIRMED","PAID"]}},_sum:{total:true}});
 const payments=await db.payment.aggregate({where:{paidAt:{gte:new Date(range.from),lt:new Date(range.to)},invoice:{status:{not:"CANCELLED"}}},_sum:{amount:true}});
 assert.equal(amount(report.totals.billed).toFixed(2),invoices._sum.total?.toFixed(2)??"0.00");
 assert.equal(amount(report.totals.collected).toFixed(2),payments._sum.amount?.toFixed(2)??"0.00");
 assert.equal(report.monthly.reduce((sum,row)=>sum.plus(row.billed),amount("0")).toFixed(2),amount(report.totals.billed).toFixed(2));
 await assert.rejects(()=>businessReport({id:"customer",role:"CUSTOMER"},range));
});
