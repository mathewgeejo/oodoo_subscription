import { requireActor, requireSameOrigin } from "../../../../server/auth/actor";
import { provisionUser } from "../../../../server/auth/provision";
import { errorResponse } from "../../../../server/core/errors";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    return Response.json({data: await provisionUser(await request.json(), actor)}, {status: 201});
  } catch (error) { return errorResponse(error); }
}
