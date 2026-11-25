import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import type { L10n, NoteTemplateSectionsDoc } from "./note-template.types";
import { parseNoteTemplateSections } from "./note-payload";

const l10nSchema = z.object({
  en: z.string().min(1),
  ru: z.string().optional(),
  az: z.string().optional(),
});

export const noteTemplateUpsertSchema = z.object({
  code: z.string().min(1).max(64),
  title: l10nSchema,
  specialty: z.string().max(64).optional().nullable(),
  sections: z.object({
    sections: z
      .array(
        z.object({
          key: z.string().min(1),
          title: l10nSchema,
          fields: z.array(
            z.object({
              key: z.string().min(1),
              type: z.enum([
                "text",
                "textarea",
                "select",
                "multiselect",
                "number",
                "date",
                "bodyMap",
              ]),
              label: l10nSchema,
              required: z.boolean().optional(),
              options: z.array(z.string()).optional(),
              quickAnswers: z.array(z.string()).optional(),
            }),
          ),
        }),
      )
      .min(1),
  }),
  isActive: z.boolean().optional(),
});

export type NoteTemplateUpsertInput = z.infer<typeof noteTemplateUpsertSchema>;

function titleToJson(title: L10n): string {
  return JSON.stringify({
    en: title.en,
    ru: title.ru ?? title.en,
    az: title.az ?? title.en,
  });
}

export function shapeNoteTemplate(row: {
  id: string;
  code: string;
  titleJson: string;
  specialty: string | null;
  sectionsJson: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  let title: L10n = { en: row.code, ru: row.code, az: row.code };
  try {
    title = JSON.parse(row.titleJson) as L10n;
  } catch {
    /* keep fallback */
  }
  return {
    id: row.id,
    code: row.code,
    title,
    specialty: row.specialty,
    sections: parseNoteTemplateSections(row.sectionsJson),
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listNoteTemplatesAdmin(includeInactive = false) {
  const rows = await prisma.clinicalNoteTemplate.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { code: "asc" },
  });
  return rows.map(shapeNoteTemplate);
}

export async function createNoteTemplateAdmin(
  input: NoteTemplateUpsertInput,
  userId: string,
  request?: { headers: { get(name: string): string | null } },
) {
  const existing = await prisma.clinicalNoteTemplate.findFirst({
    where: { code: input.code },
  });
  if (existing) {
    throw Object.assign(new Error("Template code already exists"), { status: 409, code: "CODE_EXISTS" });
  }
  const sectionsJson = JSON.stringify(input.sections satisfies NoteTemplateSectionsDoc);
  const row = await prisma.clinicalNoteTemplate.create({
    data: {
      code: input.code,
      titleJson: titleToJson(input.title),
      specialty: input.specialty ?? null,
      sectionsJson,
      isActive: input.isActive ?? true,
      version: 1,
    },
  });
  await recordClinicAudit(
    { userId, request },
    "ClinicalNoteTemplate",
    row.id,
    "CREATE",
    { code: row.code },
  );
  return shapeNoteTemplate(row);
}

export async function updateNoteTemplateAdmin(
  id: string,
  input: Partial<NoteTemplateUpsertInput>,
  userId: string,
  request?: { headers: { get(name: string): string | null } },
) {
  const current = await prisma.clinicalNoteTemplate.findUnique({ where: { id } });
  if (!current) throw Object.assign(new Error("Template not found"), { status: 404 });

  const sectionsJson = input.sections
    ? JSON.stringify(input.sections)
    : current.sectionsJson;
  const row = await prisma.clinicalNoteTemplate.update({
    where: { id },
    data: {
      titleJson: input.title ? titleToJson(input.title) : undefined,
      specialty: input.specialty === undefined ? undefined : input.specialty,
      sectionsJson,
      isActive: input.isActive ?? undefined,
      version: input.sections ? current.version + 1 : undefined,
    },
  });
  await recordClinicAudit(
    { userId, request },
    "ClinicalNoteTemplate",
    id,
    "UPDATE",
    { version: row.version },
  );
  return shapeNoteTemplate(row);
}