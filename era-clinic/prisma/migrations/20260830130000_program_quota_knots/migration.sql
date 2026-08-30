-- Wave B: PDF quota knots + package night window
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "minNights" INTEGER;
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "maxNights" INTEGER;

CREATE TABLE IF NOT EXISTS "ProgramTemplateQuotaKnot" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "ProgramTemplateQuotaKnot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramTemplateQuotaKnot_templateId_nights_procedureCode_key"
  ON "ProgramTemplateQuotaKnot"("templateId", "nights", "procedureCode");
CREATE INDEX IF NOT EXISTS "ProgramTemplateQuotaKnot_templateId_idx"
  ON "ProgramTemplateQuotaKnot"("templateId");

DO $$ BEGIN
  ALTER TABLE "ProgramTemplateQuotaKnot"
    ADD CONSTRAINT "ProgramTemplateQuotaKnot_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
