-- PostgreSQL checks complement input validation and protect worker writes.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized"
  CHECK ("email" = lower(btrim("email")));
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_valid_terms"
  CHECK ("expiresAt" > "startAt" AND "basePrice" >= 0
    AND "minimumQuantity" >= 1 AND "paymentTermDays" BETWEEN 0 AND 365
    AND "nextPeriodIndex" >= 0 AND "version" >= 0
    AND "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_pending_action"
  CHECK (("pendingAction" IS NULL) = ("pendingActionAt" IS NULL)
    AND ("pendingAction" IS NULL OR "pendingAction" IN ('PAUSE', 'CLOSE')));
ALTER TABLE "SubscriptionLine" ADD CONSTRAINT "subscription_line_valid_amounts"
  CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "taxPercent" BETWEEN 0 AND 100);
ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_valid_amounts"
  CHECK ("subtotal" >= 0 AND "discount" BETWEEN 0 AND "subtotal"
    AND "tax" >= 0 AND "total" = "subtotal" - "discount" + "tax"
    AND "currency" ~ '^[A-Z]{3}$' AND "periodIndex" >= 0 AND "periodEnd" > "periodStart");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "invoice_line_valid_amounts"
  CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "taxPercent" BETWEEN 0 AND 100
    AND "subtotal" = "quantity" * "unitPrice"
    AND "discount" BETWEEN 0 AND "subtotal" AND "tax" >= 0
    AND "total" = "subtotal" - "discount" + "tax");
ALTER TABLE "Payment" ADD CONSTRAINT "payment_positive_amount" CHECK ("amount" > 0);
