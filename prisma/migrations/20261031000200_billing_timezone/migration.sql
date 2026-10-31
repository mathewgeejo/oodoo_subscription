ALTER TABLE "Subscription" ADD COLUMN "baseTaxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "billingTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_base_tax_valid" CHECK ("baseTaxPercent" BETWEEN 0 AND 100);
