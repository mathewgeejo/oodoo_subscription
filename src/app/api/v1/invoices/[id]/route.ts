import { requireActor } from "../../../../../server/auth/actor";
import { errorResponse } from "../../../../../server/core/errors";
import { getInvoice } from "../../../../../server/invoices/service";
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  try { return Response.json({data: await getInvoice(await requireActor(request), (await context.params).id)}); }
  catch (error) { return errorResponse(error); }
}
