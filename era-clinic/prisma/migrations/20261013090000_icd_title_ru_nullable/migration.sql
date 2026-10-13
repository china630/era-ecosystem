-- Original-source ICD-10 catalog: titles missing in a source edition stay NULL (no synthetic text).
ALTER TABLE "IcdCode" ALTER COLUMN "title_ru" DROP NOT NULL;
