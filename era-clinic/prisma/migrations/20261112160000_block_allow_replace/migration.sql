ALTER TABLE "ProgramTemplateProcedure"
  ADD COLUMN "allow_replace" BOOLEAN NOT NULL DEFAULT false;

-- Blocks that already showed Əvəz et by name (bath / naftalan / paraffin).
UPDATE "ProgramTemplateProcedure"
SET "allow_replace" = true
WHERE translate(lower("procedureCode" || ' ' || "procedureName"), 'əıöüşçğ', 'eiouscg')
  ~ '(vann|bath|naftalan|aplikasiya|iod|yod[- ]?brom|4[- ]?kam|four[- ]?chamber|parafin|paraffin)';
