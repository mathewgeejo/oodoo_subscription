import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof SyntaxError) return Response.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } }, { status: 400 });
  if (error instanceof ZodError) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", fields: error.flatten().fieldErrors } }, { status: 422 });
  if (error instanceof AppError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === "P2025") return Response.json({error:{code:"NOT_FOUND",message:"Resource not found"}}, {status:404});
  if (error && typeof error === "object" && "code" in error && ["P2002", "P2034"].includes(String(error.code))) return Response.json({ error: { code: "CONFLICT", message: "Resource changed or already exists; reload before retrying" } }, { status: 409 });
  console.error("Unhandled server error", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }, { status: 500 });
}
