-- HN-8: link fb-pos tickets to hotel BEO

ALTER TABLE "tickets" ADD COLUMN "beo_id" TEXT;

CREATE INDEX "tickets_beo_id_idx" ON "tickets"("beo_id");
