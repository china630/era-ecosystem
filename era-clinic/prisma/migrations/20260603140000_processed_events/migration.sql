CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedEvent_correlationId_key" ON "ProcessedEvent"("correlationId");
CREATE INDEX "ProcessedEvent_eventType_idx" ON "ProcessedEvent"("eventType");
