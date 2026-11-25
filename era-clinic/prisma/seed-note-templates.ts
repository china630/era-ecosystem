import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

type SeedTemplate = {
  code: string;
  specialty?: string;
  title: { en: string; ru: string; az: string };
  sections: { sections: unknown[] };
};

export async function seedClinicalNoteTemplates(prisma: PrismaClient, organizationId: string) {
  const path = join(__dirname, "seed-data", "base", "note-templates.json");
  const doc = JSON.parse(readFileSync(path, "utf8")) as { templates: SeedTemplate[] };
  let count = 0;
  for (const tpl of doc.templates ?? []) {
    await prisma.clinicalNoteTemplate.upsert({
      where: {
        organizationId_code: { organizationId, code: tpl.code },
      },
      create: {
        organizationId,
        code: tpl.code,
        specialty: tpl.specialty ?? null,
        titleJson: JSON.stringify(tpl.title),
        sectionsJson: JSON.stringify(tpl.sections),
        isActive: true,
        version: 1,
      },
      update: {
        specialty: tpl.specialty ?? null,
        titleJson: JSON.stringify(tpl.title),
        sectionsJson: JSON.stringify(tpl.sections),
        isActive: true,
      },
    });
    count += 1;
  }
  return count;
}