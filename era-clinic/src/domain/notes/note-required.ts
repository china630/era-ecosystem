import type { ClinicalNoteFieldSnap } from "./note-payload";

export const NOTE_REQUIRED_FIELDS = "NOTE_REQUIRED_FIELDS";

export type NoteRequiredFieldRef = {
  key: string;
  label?: string;
};

export function listMissingRequiredFields(input: {
  fieldDefs: ClinicalNoteFieldSnap[];
  fields: Record<string, string>;
}): NoteRequiredFieldRef[] {
  const missing: NoteRequiredFieldRef[] = [];
  for (const def of input.fieldDefs) {
    if (!def.required) continue;
    const raw = input.fields[def.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      missing.push({ key: def.key, label: def.label?.en || def.key });
    }
  }
  return missing;
}

export function assertNoteRequiredFieldsFilled(input: {
  fieldDefs: ClinicalNoteFieldSnap[];
  fields: Record<string, string>;
}): void {
  const missing = listMissingRequiredFields(input);
  if (missing.length > 0) {
    const err = new Error("Required clinical note fields are missing") as Error & {
      code: string;
      missing: NoteRequiredFieldRef[];
    };
    err.code = NOTE_REQUIRED_FIELDS;
    err.missing = missing;
    throw err;
  }
}