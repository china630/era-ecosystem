import type { L10n, NoteTemplateFieldDef, NoteTemplateSectionsDoc } from "./note-template.types";

export const NOTE_PAYLOAD_VERSION = 1 as const;

export type ClinicalNoteFieldSnap = {
  key: string;
  type: string;
  label: L10n;
  required?: boolean;
  options?: string[];
};

export type ClinicalNotePayloadV1 = {
  v: typeof NOTE_PAYLOAD_VERSION;
  templateCode: string;
  title: L10n;
  fields: Record<string, string>;
  fieldDefs: ClinicalNoteFieldSnap[];
};

function asL10n(raw: L10n | string | undefined, fallback: string): L10n {
  if (!raw) return { en: fallback, ru: fallback, az: fallback };
  if (typeof raw === "string") return { en: raw, ru: raw, az: raw };
  return {
    en: raw.en || fallback,
    ru: raw.ru || raw.en || fallback,
    az: raw.az || raw.en || fallback,
  };
}

export function parseNoteTemplateSections(raw: string): NoteTemplateSectionsDoc {
  try {
    const parsed = JSON.parse(raw) as NoteTemplateSectionsDoc;
    if (!parsed?.sections || !Array.isArray(parsed.sections)) {
      return { sections: [] };
    }
    return parsed;
  } catch {
    return { sections: [] };
  }
}

function flattenTemplateFields(doc: NoteTemplateSectionsDoc): NoteTemplateFieldDef[] {
  const out: NoteTemplateFieldDef[] = [];
  for (const section of doc.sections) {
    for (const field of section.fields ?? []) {
      out.push(field);
    }
  }
  return out;
}

export function buildClinicalNotePayloadSnapshot(input: {
  templateCode: string;
  title: L10n;
  sectionsJson: string;
  fieldValues: Record<string, string>;
}): ClinicalNotePayloadV1 {
  const doc = parseNoteTemplateSections(input.sectionsJson);
  const defs = flattenTemplateFields(doc);
  const fieldDefs: ClinicalNoteFieldSnap[] = defs.map((f) => ({
    key: f.key,
    type: f.type,
    label: asL10n(f.label, f.key),
    required: Boolean(f.required),
    options: f.options,
  }));
  return {
    v: NOTE_PAYLOAD_VERSION,
    templateCode: input.templateCode,
    title: asL10n(input.title, input.templateCode),
    fields: { ...input.fieldValues },
    fieldDefs,
  };
}

export function parseClinicalNotePayload(raw: string): Partial<ClinicalNotePayloadV1> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<ClinicalNotePayloadV1>;
  } catch {
    return {};
  }
}