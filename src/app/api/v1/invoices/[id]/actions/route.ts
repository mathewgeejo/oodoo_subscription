import { z } from "zod";
import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { errorResponse } from "../../../../../../server/core/errors";
import { actOnInvoice } from "../../../../../../server/invoices/service";
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    const {action} = z.object({action: z.enum(["CONFIRM", "CANCEL"])}).parse(await request.json());
    return Response.json({data: await actOnInvoice(actor, (await context.params).id, action)});
  } catch (error) { return errorResponse(error); }
}
