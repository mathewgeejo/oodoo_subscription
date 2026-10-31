import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", fields: error.flatten().fieldErrors } }, { status: 422 });
  if (error instanceof AppError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error("Unhandled server error", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }, { status: 500 });
}
