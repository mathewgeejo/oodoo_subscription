import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { errorResponse } from "../../../../../../server/core/errors";
import { actionSchema } from "../../../../../../server/subscriptions/contracts";
import { actOnSubscription } from "../../../../../../server/subscriptions/service";
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    const {action} = actionSchema.parse(await request.json());
    return Response.json({data: await actOnSubscription(actor, (await context.params).id, action)});
  } catch (error) { return errorResponse(error); }
}
