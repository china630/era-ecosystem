-- CLI-51: entitlement block membership + procedure kind/sortOrder
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "program_template_block_member" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "block_code" TEXT NOT NULL,
    "procedure_code" TEXT NOT NULL,

    CONSTRAINT "program_template_block_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "program_template_block_member_template_id_block_code_procedure_code_key"
  ON "program_template_block_member"("template_id", "block_code", "procedure_code");

CREATE INDEX IF NOT EXISTS "program_template_block_member_template_id_block_code_idx"
  ON "program_template_block_member"("template_id", "block_code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_template_block_member_template_id_fkey'
  ) THEN
    ALTER TABLE "program_template_block_member"
      ADD CONSTRAINT "program_template_block_member_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "ProgramTemplate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
