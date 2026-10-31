import { requireActor } from "../../../../server/auth/actor";
import { errorResponse } from "../../../../server/core/errors";
import { businessReport } from "../../../../server/reports/service";
export async function GET(request: Request) {
  try {
    return Response.json({
      data: await businessReport(
        await requireActor(request),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
