import { z } from "zod";
import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { errorResponse } from "../../../../../../server/core/errors";
import { renewSubscription } from "../../../../../../server/subscriptions/service";
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    const {expiresAt} = z.object({expiresAt: z.iso.datetime().transform(value => new Date(value))}).parse(await request.json());
    return Response.json({data: await renewSubscription(actor, (await context.params).id, expiresAt)});
  } catch (error) { return errorResponse(error); }
}
