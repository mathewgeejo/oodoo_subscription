import { db } from "../../../server/db";
export const dynamic = "force-dynamic";
/** Database connectivity readiness; worker progress is reported to admins. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({status: "ready"});
  } catch { return Response.json({status: "not_ready"}, {status: 503}); }
}
