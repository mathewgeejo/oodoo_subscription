import { db } from "../../../../server/db";
import { requireActor, requireSameOrigin } from "../../../../server/auth/actor";
import { paginationSchema } from "../../../../server/core/contracts";
import { errorResponse } from "../../../../server/core/errors";
import { createDraft } from "../../../../server/subscriptions/service";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const {page, pageSize} = paginationSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const where = actor.role === "CUSTOMER" ? {customerId: actor.id} : {};
    const [data, total] = await db.$transaction([
      db.subscription.findMany({where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{createdAt: "desc"}, {id: "desc"}]}),
      db.subscription.count({where}),
    ]);
    return Response.json({data, pagination: {page, pageSize, total}});
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json({data: await createDraft(await requireActor(request), await request.json())}, {status: 201});
  } catch (error) { return errorResponse(error); }
}
