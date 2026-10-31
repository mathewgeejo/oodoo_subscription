import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { errorResponse } from "../../../../../../server/core/errors";
import { paginationSchema } from "../../../../../../server/core/contracts";
import { recordManualPayment } from "../../../../../../server/payments/manual";
import { getInvoice } from "../../../../../../server/invoices/service";
import { db } from "../../../../../../server/db";
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    return Response.json({data: await recordManualPayment(actor, (await context.params).id, await request.json())}, {status: 201});
  } catch (error) { return errorResponse(error); }
}
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    const actor = await requireActor(request);
    const {id} = await context.params;
    await getInvoice(actor, id);
    const {page, pageSize} = paginationSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const [data, total] = await db.$transaction([
      db.payment.findMany({where: {invoiceId: id}, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{paidAt: "desc"}, {id: "desc"}], select: {id: true, amount: true, method: true, paidAt: true, note: true, externalReference: true}}),
      db.payment.count({where: {invoiceId: id}}),
    ]);
    return Response.json({data, pagination: {page, pageSize, total}});
  } catch (error) { return errorResponse(error); }
}
