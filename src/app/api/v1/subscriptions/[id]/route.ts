import { requireActor } from "../../../../../server/auth/actor";
import { requireOwnerOrStaff } from "../../../../../server/core/permissions";
import { errorResponse, AppError } from "../../../../../server/core/errors";
import { db } from "../../../../../server/db";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(request);
    const subscription = await db.subscription.findUnique({
      where: { id: (await context.params).id },
      include: {
        lines: true,
        customer: { select: { name: true, email: true } },
      },
    });
    if (!subscription)
      throw new AppError("NOT_FOUND", "Resource not found", 404);
    requireOwnerOrStaff(actor, subscription.customerId);
    return Response.json({ data: subscription });
  } catch (error) {
    return errorResponse(error);
  }
}
