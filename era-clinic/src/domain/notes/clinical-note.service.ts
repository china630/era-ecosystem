import { ClinicalNoteKind, ClinicalNoteStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  assertNoteRequiredFieldsFilled,
  NOTE_REQUIRED_FIELDS,
} from "./note-required";
import {
  buildClinicalNotePayloadSnapshot,
  parseClinicalNotePayload,
  parseNoteTemplateSections,
  type ClinicalNotePayloadV1,
} from "./note-payload";
import type { L10n } from "./note-template.types";

export const NOTE_NOT_DRAFT = "NOTE_NOT_DRAFT";
export const NOTE_NOT_AUTHOR = "NOTE_NOT_AUTHOR";
export const NOTE_ALREADY_SIGNED = "NOTE_ALREADY_SIGNED";

export async function findPractitionerIdForUser(userId: string): Promise<string | null> {
  const row = await prisma.practitioner.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

function parseTitleJson(raw: string): L10n {
  try {
    return JSON.parse(raw) as L10n;
  } catch {
    return { en: "", ru: "", az: "" };
  }
}

export function shapeClinicalNote(row: {
  id: string;
  visitId: string | null;
  clinicalEpisodeId: string | null;
  admissionId: string | null;
  patientRefId: string;
  authorPractitionerId: string;
  templateId: string;
  templateVersion: number;
  kind: ClinicalNoteKind;
  payloadJson: string;
  status: ClinicalNoteStatus;
  signedAt: Date | null;
  signedByUserId: string | null;
  amendsNoteId: string | null;
  createdAt: Date;
  updatedAt: Date;
  template?: { code: string; titleJson: string };
}) {
  return {
    id: row.id,
    visitId: row.visitId,
    clinicalEpisodeId: row.clinicalEpisodeId,
    admissionId: row.admissionId,
    patientRefId: row.patientRefId,
    authorPractitionerId: row.authorPractitionerId,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    templateCode: row.template?.code ?? null,
    kind: row.kind,
    payload: parseClinicalNotePayload(row.payloadJson),
    status: row.status,
    signedAt: row.signedAt?.toISOString() ?? null,
    signedByUserId: row.signedByUserId,
    amendsNoteId: row.amendsNoteId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listVisitClinicalNotes(visitId: string) {
  const rows = await prisma.clinicalNote.findMany({
    where: { visitId },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { code: true, titleJson: true } } },
  });
  return rows.map(shapeClinicalNote);
}

export async function listActiveNoteTemplates() {
  const rows = await prisma.clinicalNoteTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ specialty: "asc" }, { code: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: parseTitleJson(row.titleJson),
    specialty: row.specialty,
    sections: parseNoteTemplateSections(row.sectionsJson),
    version: row.version,
  }));
}

type CreateVisitNoteInput = {
  visitId: string;
  templateId: string;
  kind?: ClinicalNoteKind;
  fieldValues?: Record<string, string>;
  copyFromNoteId?: string;
  authorPractitionerId: string;
  userId: string;
  request?: { headers: { get(name: string): string | null } };
};

export async function createVisitClinicalNote(input: CreateVisitNoteInput) {
  const visit = await prisma.visit.findUnique({
    where: { id: input.visitId },
    select: {
      id: true,
      patientRefId: true,
      clinicalEpisodeId: true,
      practitionerId: true,
    },
  });
  if (!visit) throw Object.assign(new Error("Visit not found"), { status: 404 });

  const template = await prisma.clinicalNoteTemplate.findFirst({
    where: { id: input.templateId, isActive: true },
  });
  if (!template) throw Object.assign(new Error("Template not found"), { status: 404 });

  let fieldValues = { ...(input.fieldValues ?? {}) };
  if (input.copyFromNoteId) {
    const source = await prisma.clinicalNote.findFirst({
      where: { id: input.copyFromNoteId, patientRefId: visit.patientRefId },
    });
    if (source) {
      const payload = parseClinicalNotePayload(source.payloadJson);
      fieldValues = { ...payload.fields, ...fieldValues };
    }
  }

  const payload = buildClinicalNotePayloadSnapshot({
    templateCode: template.code,
    title: parseTitleJson(template.titleJson),
    sectionsJson: template.sectionsJson,
    fieldValues,
  });

  const row = await prisma.clinicalNote.create({
    data: {
      visitId: visit.id,
      clinicalEpisodeId: visit.clinicalEpisodeId,
      patientRefId: visit.patientRefId,
      authorPractitionerId: input.authorPractitionerId,
      templateId: template.id,
      templateVersion: template.version,
      kind: input.kind ?? ClinicalNoteKind.VISIT_EXAM,
      payloadJson: JSON.stringify(payload),
      status: ClinicalNoteStatus.DRAFT,
    },
    include: { template: { select: { code: true, titleJson: true } } },
  });

  await recordClinicAudit(
    { userId: input.userId, request: input.request },
    "ClinicalNote",
    row.id,
    "CREATE",
    { visitId: visit.id, templateCode: template.code },
  );

  return shapeClinicalNote(row);
}

export async function updateClinicalNoteDraft(
  noteId: string,
  fieldValues: Record<string, string>,
  userId: string,
  request?: { headers: { get(name: string): string | null } },
) {
  const note = await prisma.clinicalNote.findUnique({
    where: { id: noteId },
    include: { template: true },
  });
  if (!note) throw Object.assign(new Error("Note not found"), { status: 404 });
  if (note.status !== ClinicalNoteStatus.DRAFT) {
    throw Object.assign(new Error("Only draft notes can be edited"), {
      status: 409,
      code: NOTE_NOT_DRAFT,
    });
  }

  const existing = parseClinicalNotePayload(note.payloadJson);
  const merged = { ...(existing.fields ?? {}), ...fieldValues };
  const payload = buildClinicalNotePayloadSnapshot({
    templateCode: note.template.code,
    title: parseTitleJson(note.template.titleJson),
    sectionsJson: note.template.sectionsJson,
    fieldValues: merged,
  });

  const row = await prisma.clinicalNote.update({
    where: { id: noteId },
    data: { payloadJson: JSON.stringify(payload) },
    include: { template: { select: { code: true, titleJson: true } } },
  });

  await recordClinicAudit(
    { userId, request },
    "ClinicalNote",
    noteId,
    "UPDATE",
    { keys: Object.keys(fieldValues) },
  );

  return shapeClinicalNote(row);
}

export async function signClinicalNote(input: {
  noteId: string;
  userId: string;
  authorPractitionerId: string | null;
  request?: { headers: { get(name: string): string | null } };
}) {
  const note = await prisma.clinicalNote.findUnique({
    where: { id: input.noteId },
    include: { template: true },
  });
  if (!note) throw Object.assign(new Error("Note not found"), { status: 404 });
  if (note.status === ClinicalNoteStatus.SIGNED) {
    throw Object.assign(new Error("Note already signed"), {
      status: 409,
      code: NOTE_ALREADY_SIGNED,
    });
  }
  if (note.status !== ClinicalNoteStatus.DRAFT) {
    throw Object.assign(new Error("Only draft notes can be signed"), {
      status: 409,
      code: NOTE_NOT_DRAFT,
    });
  }
  if (!input.authorPractitionerId || input.authorPractitionerId !== note.authorPractitionerId) {
    throw Object.assign(new Error("Only the authoring practitioner may sign"), {
      status: 403,
      code: NOTE_NOT_AUTHOR,
    });
  }

  const payload = parseClinicalNotePayload(note.payloadJson) as ClinicalNotePayloadV1;
  try {
    assertNoteRequiredFieldsFilled({
      fieldDefs: payload.fieldDefs ?? [],
      fields: payload.fields ?? {},
    });
  } catch (err) {
    const e = err as Error & { code?: string; missing?: unknown };
    throw Object.assign(new Error(e.message), {
      status: 409,
      code: e.code ?? NOTE_REQUIRED_FIELDS,
      missing: e.missing,
    });
  }

  const row = await prisma.clinicalNote.update({
    where: { id: input.noteId },
    data: {
      status: ClinicalNoteStatus.SIGNED,
      signedAt: new Date(),
      signedByUserId: input.userId,
    },
    include: { template: { select: { code: true, titleJson: true } } },
  });

  await recordClinicAudit(
    { userId: input.userId, request: input.request },
    "ClinicalNote",
    input.noteId,
    "SIGN",
    {},
  );

  return shapeClinicalNote(row);
}

export async function amendClinicalNote(input: {
  noteId: string;
  userId: string;
  authorPractitionerId: string;
  fieldValues?: Record<string, string>;
  request?: { headers: { get(name: string): string | null } };
}) {
  const note = await prisma.clinicalNote.findUnique({
    where: { id: input.noteId },
    include: { template: true },
  });
  if (!note) throw Object.assign(new Error("Note not found"), { status: 404 });
  if (note.status !== ClinicalNoteStatus.SIGNED) {
    throw Object.assign(new Error("Only signed notes can be amended"), {
      status: 409,
      code: NOTE_NOT_DRAFT,
    });
  }

  const basePayload = parseClinicalNotePayload(note.payloadJson);
  const merged = { ...(basePayload.fields ?? {}), ...(input.fieldValues ?? {}) };
  const payload = buildClinicalNotePayloadSnapshot({
    templateCode: note.template.code,
    title: parseTitleJson(note.template.titleJson),
    sectionsJson: note.template.sectionsJson,
    fieldValues: merged,
  });

  const [, amended] = await prisma.$transaction([
    prisma.clinicalNote.update({
      where: { id: note.id },
      data: { status: ClinicalNoteStatus.AMENDED },
    }),
    prisma.clinicalNote.create({
      data: {
        visitId: note.visitId,
        clinicalEpisodeId: note.clinicalEpisodeId,
        admissionId: note.admissionId,
        patientRefId: note.patientRefId,
        authorPractitionerId: input.authorPractitionerId,
        templateId: note.templateId,
        templateVersion: note.templateVersion,
        kind: note.kind,
        payloadJson: JSON.stringify(payload),
        status: ClinicalNoteStatus.DRAFT,
        amendsNoteId: note.id,
      },
      include: { template: { select: { code: true, titleJson: true } } },
    }),
  ]);

  await recordClinicAudit(
    { userId: input.userId, request: input.request },
    "ClinicalNote",
    note.id,
    "AMEND",
    { draftId: amended.id },
  );

  return shapeClinicalNote(amended as Prisma.ClinicalNoteGetPayload<{
    include: { template: { select: { code: true; titleJson: true } } };
  }>);
}