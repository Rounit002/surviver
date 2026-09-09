CREATE TABLE "payment_events" (
 "id" TEXT NOT NULL,
 "paymentId" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_events_paymentId_idx" ON "payment_events"("paymentId");
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
