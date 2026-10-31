import { verifyStripeEvent, handleStripeEvent } from "../../../../server/payments/stripe";
import { AppError, errorResponse } from "../../../../server/core/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new AppError("INVALID_SIGNATURE", "Missing payment signature", 400);
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("INVALID_BODY", "Missing webhook payload", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1000000) {await reader.cancel(); throw new AppError("PAYLOAD_TOO_LARGE", "Webhook payload exceeds limit", 413);}
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
    return Response.json(await handleStripeEvent(verifyStripeEvent(Buffer.concat(chunks), signature)));
  } catch (error) { return errorResponse(error); }
}
