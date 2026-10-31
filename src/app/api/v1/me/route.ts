import { requireActor } from "../../../../server/auth/actor";
import { errorResponse } from "../../../../server/core/errors";
export async function GET(request: Request) {
  try { return Response.json({ data: await requireActor(request) }); }
  catch (error) { return errorResponse(error); }
}
