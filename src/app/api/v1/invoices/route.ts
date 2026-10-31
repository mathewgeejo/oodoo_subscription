import { requireActor } from "../../../../server/auth/actor";
import { errorResponse } from "../../../../server/core/errors";
import { listInvoices } from "../../../../server/invoices/service";
export async function GET(request: Request) {
  try { return Response.json(await listInvoices(await requireActor(request), Object.fromEntries(new URL(request.url).searchParams))); }
  catch (error) { return errorResponse(error); }
}
