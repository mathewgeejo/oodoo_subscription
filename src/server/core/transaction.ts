import { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "./errors";
export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(work, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable}); }
    catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
      if (!retryable) throw error;
      if (attempt >= 3) throw new AppError("CONFLICT", "Concurrent update; retry the operation", 409);
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
