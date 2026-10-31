CREATE TABLE "ProviderReceipt" (
  "id" TEXT PRIMARY KEY,
  "attemptId" TEXT NOT NULL REFERENCES "CheckoutAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "providerSessionId" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "currency" TEXT,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProviderReceipt_outcome_createdAt_idx" ON "ProviderReceipt" ("outcome", "createdAt");
