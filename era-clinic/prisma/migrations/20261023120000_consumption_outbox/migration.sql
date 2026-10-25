CREATE TABLE "consumption_outbox" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "consumption_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumption_outbox_source_ref_key" ON "consumption_outbox"("source_ref");
CREATE INDEX "consumption_outbox_organization_id_status_idx" ON "consumption_outbox"("organization_id", "status");
