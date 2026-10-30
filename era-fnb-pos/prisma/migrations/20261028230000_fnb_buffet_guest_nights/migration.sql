-- Guest-night entries for buffet forecast pack (Wave 6).
-- ADR: docs/adr/fnb-buffet-cost-attribution.md

CREATE TABLE "buffet_guest_night_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "service_date" DATE NOT NULL,
    "guest_nights" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buffet_guest_night_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "buffet_guest_night_entries_organization_id_service_date_key" ON "buffet_guest_night_entries"("organization_id", "service_date");
CREATE INDEX "buffet_guest_night_entries_organization_id_service_date_idx" ON "buffet_guest_night_entries"("organization_id", "service_date");

ALTER TABLE "buffet_guest_night_entries" ADD CONSTRAINT "buffet_guest_night_entries_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
