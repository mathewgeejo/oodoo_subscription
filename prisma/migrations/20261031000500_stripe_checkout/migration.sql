-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('RESERVING', 'OPEN', 'PAID', 'EXPIRED', 'FAILED', 'EXCEPTION');

-- CreateTable
CREATE TABLE "CheckoutAttempt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'RESERVING',
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "receivedAmount" DECIMAL(18,2),
    "receivedCurrency" TEXT,
    "checkoutUrl" TEXT,
    "failureCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "nextReconcileAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_idempotencyKey_key" ON "CheckoutAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_providerSessionId_key" ON "CheckoutAttempt"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_providerPaymentId_key" ON "CheckoutAttempt"("providerPaymentId");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_status_nextReconcileAt_idx" ON "CheckoutAttempt"("status", "nextReconcileAt");

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "checkout_one_active_reservation" ON "CheckoutAttempt" ("invoiceId") WHERE "status" IN ('RESERVING', 'OPEN');
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "checkout_valid_amounts" CHECK ("amount" > 0 AND "currency" ~ '^[A-Z]{3}$' AND ("receivedAmount" IS NULL OR "receivedAmount" >= 0));
