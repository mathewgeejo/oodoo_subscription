export const dynamic = "force-dynamic";
/** Liveness only. Database readiness is checked separately. */
export function GET() {
  return Response.json({ status: "ok", service: "brightloop-web" });
}
