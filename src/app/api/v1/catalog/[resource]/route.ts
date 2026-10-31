import { requireActor, requireSameOrigin } from "../../../../../server/auth/actor";
import { errorResponse } from "../../../../../server/core/errors";
import { resourceSchema, listCatalog, saveCatalog } from "../../../../../server/catalog/service";
type Context = {params: Promise<{resource: string}>};
export async function GET(request: Request, context: Context) {
  try {return Response.json(await listCatalog(await requireActor(request), resourceSchema.parse((await context.params).resource), Object.fromEntries(new URL(request.url).searchParams)));}
  catch (error) {return errorResponse(error);}
}
export async function POST(request: Request, context: Context) {
  try {requireSameOrigin(request); return Response.json({data: await saveCatalog(await requireActor(request), resourceSchema.parse((await context.params).resource), await request.json())}, {status: 201});}
  catch (error) {return errorResponse(error);}
}
