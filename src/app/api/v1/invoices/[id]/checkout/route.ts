import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { errorResponse } from "../../../../../../server/core/errors";
import { startCheckout, getCheckoutStatus } from "../../../../../../server/payments/stripe";
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  try { return Response.json({data: await getCheckoutStatus(await requireActor(request), (await context.params).id)}); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    const attempt = await startCheckout(actor, (await context.params).id, await request.json());
    return Response.json({data: {id: attempt.id, status: attempt.status, url: attempt.status === "OPEN" ? attempt.checkoutUrl : null, expiresAt: attempt.expiresAt, failureCode: attempt.failureCode}});
  } catch (error) { return errorResponse(error); }
}
