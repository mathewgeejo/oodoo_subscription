import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { requirePermission } from "../../../../../../server/core/permissions";
import { errorResponse } from "../../../../../../server/core/errors";
import { billSubscription } from "../../../../../../server/billing/service";
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    requirePermission(actor, "business:write");
    return Response.json({data: await billSubscription((await context.params).id, new Date(), actor.id)});
  } catch (error) { return errorResponse(error); }
}
