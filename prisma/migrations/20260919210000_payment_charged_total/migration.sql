-- Keep gross settlement separate from the entry price for tax-aware refunds.
ALTER TABLE "payments" ADD COLUMN "chargedAmountCents" INTEGER;
