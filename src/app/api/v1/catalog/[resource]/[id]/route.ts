import { requireActor, requireSameOrigin } from "../../../../../../server/auth/actor";
import { errorResponse } from "../../../../../../server/core/errors";
import { resourceSchema, saveCatalog } from "../../../../../../server/catalog/service";
export async function PUT(request: Request, context: {params: Promise<{resource: string; id: string}>}) {
  try {
    requireSameOrigin(request);
    const actor = await requireActor(request);
    const {resource, id} = await context.params;
    return Response.json({data: await saveCatalog(actor, resourceSchema.parse(resource), await request.json(), id)});
  } catch (error) {return errorResponse(error);}
}
