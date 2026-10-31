import { z } from "zod";
import { db } from "../../../../server/db";
import { requireActor, requireSameOrigin } from "../../../../server/auth/actor";
import { requirePermission } from "../../../../server/core/permissions";
import { paginationSchema } from "../../../../server/core/contracts";
import { errorResponse } from "../../../../server/core/errors";
import { provisionUser } from "../../../../server/auth/provision";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    requirePermission(actor, "business:write");
    const { page, pageSize, search } = paginationSchema
      .extend({ search: z.string().trim().max(200).default("") })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const where = {
      role: "CUSTOMER" as const,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await db.$transaction([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: { select: { subscriptions: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ]);
    return Response.json({ data, pagination: { page, pageSize, total } });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json(
      {
        data: await provisionUser(
          await request.json(),
          await requireActor(request),
          "CUSTOMER",
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
