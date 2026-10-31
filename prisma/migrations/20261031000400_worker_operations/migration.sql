ALTER TABLE "Subscription" ADD COLUMN "billingFailureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "billingRetryAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "billingLastError" TEXT;
CREATE TABLE "WorkerHeartbeat" ("id" TEXT PRIMARY KEY, "lastSeen" TIMESTAMP(3) NOT NULL);
