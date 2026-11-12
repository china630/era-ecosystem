CREATE TABLE "person_dedup_dismissals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id_low" UUID NOT NULL,
    "person_id_high" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "person_dedup_dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "person_dedup_dismissals_person_id_low_person_id_high_key" ON "person_dedup_dismissals"("person_id_low", "person_id_high");

ALTER TABLE "person_dedup_dismissals" ADD CONSTRAINT "person_dedup_dismissals_person_id_low_fkey" FOREIGN KEY ("person_id_low") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person_dedup_dismissals" ADD CONSTRAINT "person_dedup_dismissals_person_id_high_fkey" FOREIGN KEY ("person_id_high") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
