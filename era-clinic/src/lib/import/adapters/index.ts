import { z } from "zod";
import type { ImportAdapter, ImportEntityMeta, ImportTx, UpsertOutcome } from "@/lib/import/types";
import { cellNumber, cellString, parseDateCell } from "@/lib/import/helpers";
import { bindImportRecord, findImportRecordId } from "@/lib/import/keys";

function aliases(...keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, k]));
}

function req(value: unknown): string {
  const s = cellString(value);
  if (!s) throw new Error("Required cell is empty");
  return s;
}

async function upsertByRef(
  tx: ImportTx,
  entity: string,
  ref: string,
  dryRun: boolean,
  create: () => Promise<string>,
  update: (id: string) => Promise<void>,
): Promise<UpsertOutcome> {
  const existingId = await findImportRecordId(tx, entity, ref);
  if (dryRun) return existingId ? "updated" : "created";
  if (existingId) {
    await update(existingId);
    return "updated";
  }
  const id = await create();
  await bindImportRecord(tx, entity, ref, id, false);
  return "created";
}

function toStaffKind(role: string): "DOCTOR" | "NURSE" | "LAB" {
  const r = role.toUpperCase();
  if (r === "NURSE") return "NURSE";
  if (r === "LAB") return "LAB";
  return "DOCTOR";
}

const proceduresAdapter: ImportAdapter<{
  externalRef: string;
  code: string;
  nameAz: string;
  durationMin: number;
  resourceGapMinutes: number;
  patientRestMinutes: number;
  price: number;
}> = {
  entity: "procedures",
  label: "Procedures",
  order: 10,
  templateHint: "01-procedures.xlsx",
  headerAliases: aliases(
    "externalRef",
    "code",
    "nameAz",
    "durationMin",
    "resourceGapMinutes",
    "patientRestMinutes",
    "price",
  ),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    code: z.string().min(1),
    nameAz: z.string().min(1),
    durationMin: z.number(),
    resourceGapMinutes: z.number(),
    patientRestMinutes: z.number(),
    price: z.number(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    code: req(raw.code),
    nameAz: req(raw.nameAz),
    durationMin: cellNumber(raw.durationMin) ?? 10,
    resourceGapMinutes: cellNumber(raw.resourceGapMinutes) ?? 5,
    patientRestMinutes: cellNumber(raw.patientRestMinutes) ?? 15,
    price: cellNumber(raw.price) ?? 0,
  }),
  upsert: (tx, row, dryRun) =>
    upsertByRef(
      tx,
      "procedures",
      row.externalRef,
      dryRun,
      async () =>
        (
          await tx.procedureType.create({
            data: {
              code: row.code,
              name: row.nameAz,
              durationMin: row.durationMin,
              resourceGapMinutes: row.resourceGapMinutes,
              patientRestMinutes: row.patientRestMinutes,
            },
          })
        ).id,
      async (id) => {
        await tx.procedureType.update({
          where: { id },
          data: {
            code: row.code,
            name: row.nameAz,
            durationMin: row.durationMin,
            resourceGapMinutes: row.resourceGapMinutes,
            patientRestMinutes: row.patientRestMinutes,
          },
        });
      },
    ),
};

const roomsAdapter: ImportAdapter<{ externalRef: string; code: string; name: string }> = {
  entity: "rooms",
  label: "Rooms",
  order: 11,
  templateHint: "02-rooms.xlsx",
  headerAliases: aliases("externalRef", "code", "name"),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    code: req(raw.code),
    name: req(raw.name),
  }),
  upsert: (tx, row, dryRun) =>
    upsertByRef(
      tx,
      "rooms",
      row.externalRef,
      dryRun,
      async () => {
        const room = await tx.room.create({ data: { code: row.code, name: row.name } });
        await tx.resource.create({
          data: { code: row.code, name: row.name, kind: "ROOM", roomId: room.id },
        });
        return room.id;
      },
      async (id) => {
        await tx.room.update({ where: { id }, data: { code: row.code, name: row.name } });
        const resource = await tx.resource.findFirst({ where: { code: row.code } });
        if (resource) {
          await tx.resource.update({
            where: { id: resource.id },
            data: { name: row.name, roomId: id, kind: "ROOM" },
          });
        } else {
          await tx.resource.create({
            data: { code: row.code, name: row.name, kind: "ROOM", roomId: id },
          });
        }
      },
    ),
};

const practitionersAdapter: ImportAdapter<{
  externalRef: string;
  fin: string;
  fullName: string;
  role: string;
}> = {
  entity: "practitioners",
  label: "Practitioners",
  order: 20,
  templateHint: "03-practitioners.xlsx",
  headerAliases: aliases("externalRef", "fin", "fullName", "role"),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    fin: z.string(),
    fullName: z.string().min(1),
    role: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    fin: cellString(raw.fin) ?? "",
    fullName: req(raw.fullName),
    role: cellString(raw.role) ?? "DOCTOR",
  }),
  upsert: (tx, row, dryRun) =>
    upsertByRef(
      tx,
      "practitioners",
      row.externalRef,
      dryRun,
      async () =>
        (
          await tx.practitioner.create({
            data: {
              code: row.fin || row.externalRef,
              fullName: row.fullName,
              staffKind: toStaffKind(row.role),
            },
          })
        ).id,
      async (id) => {
        await tx.practitioner.update({
          where: { id },
          data: { fullName: row.fullName, staffKind: toStaffKind(row.role) },
        });
      },
    ),
};

const patientsAdapter: ImportAdapter<{
  externalRef: string;
  fullName: string;
  sex: string;
  birthDate: string;
  hotelResNo: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  programCode: string;
}> = {
  entity: "patients",
  label: "Patients",
  order: 30,
  templateHint: "04-patients.xlsx",
  headerAliases: aliases(
    "externalRef",
    "fullName",
    "sex",
    "birthDate",
    "hotelResNo",
    "roomNumber",
    "checkIn",
    "checkOut",
    "programCode",
  ),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    fullName: z.string().min(1),
    sex: z.string(),
    birthDate: z.string(),
    hotelResNo: z.string(),
    roomNumber: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
    programCode: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    fullName: req(raw.fullName),
    sex: cellString(raw.sex) ?? "UNKNOWN",
    birthDate: cellString(raw.birthDate) ?? "",
    hotelResNo: cellString(raw.hotelResNo) ?? "",
    roomNumber: cellString(raw.roomNumber) ?? "",
    checkIn: cellString(raw.checkIn) ?? "",
    checkOut: cellString(raw.checkOut) ?? "",
    programCode: cellString(raw.programCode) ?? "",
  }),
  upsert: (tx, row, dryRun) =>
    upsertByRef(
      tx,
      "patients",
      row.externalRef,
      dryRun,
      async () => {
        const sex =
          row.sex === "MALE" || row.sex === "FEMALE" || row.sex === "OTHER"
            ? row.sex
            : row.sex === "MALE"
              ? "MALE"
              : row.sex === "FEMALE"
                ? "FEMALE"
                : "UNKNOWN";
        const patient = await tx.patientRef.create({
          data: {
            refCode: row.externalRef.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48),
            fullName: row.fullName,
            sex,
            birthDate: parseDateCell(row.birthDate),
            anamnesisText: "Nafta cutover import (MDM deferred)",
            anamnesisUpdatedAt: new Date(),
          },
        });
        await tx.clinicalEpisode.create({
          data: {
            patientRefId: patient.id,
            roomNumber: row.roomNumber || null,
            reservationId: row.hotelResNo || null,
            programCode: row.programCode || null,
            patientOrigin: "IN_HOUSE",
            status: "OPEN",
          },
        });
        return patient.id;
      },
      async (id) => {
        await tx.patientRef.update({ where: { id }, data: { fullName: row.fullName } });
        const episode = await tx.clinicalEpisode.findFirst({
          where: { patientRefId: id, status: "OPEN" },
        });
        if (episode) {
          await tx.clinicalEpisode.update({
            where: { id: episode.id },
            data: {
              roomNumber: row.roomNumber || episode.roomNumber,
              programCode: row.programCode || episode.programCode,
            },
          });
        }
      },
    ),
};

const quotasAdapter: ImportAdapter<{
  patientRef: string;
  procedureCode: string;
  quotaTotal: number;
  quotaUsed: number;
  quotaLeft: number;
}> = {
  entity: "quotas",
  label: "Quotas",
  order: 40,
  templateHint: "05-quotas.xlsx",
  headerAliases: {
    ...aliases("patientRef", "procedureCode", "quotaTotal", "quotaUsed", "quotaLeft"),
    quotaTotal: "quotaTotal",
    quotaUsed: "quotaUsed",
  },
  rowSchema: z.object({
    patientRef: z.string().min(1),
    procedureCode: z.string().min(1),
    quotaTotal: z.number(),
    quotaUsed: z.number(),
    quotaLeft: z.number(),
  }),
  mapRow: (raw) => ({
    patientRef: req(raw.patientRef),
    procedureCode: req(raw.procedureCode),
    quotaTotal: cellNumber(raw.quotaTotal ?? raw.quotaTotal) ?? 0,
    quotaUsed: cellNumber(raw.quotaUsed ?? raw.quotaUsed) ?? 0,
    quotaLeft: cellNumber(raw.quotaLeft) ?? 0,
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    const used = Math.min(Math.max(0, row.quotaUsed), Math.max(0, row.quotaTotal));
    if (dryRun) return "updated";
    const episode = await tx.clinicalEpisode.findFirst({
      where: { patientRefId: patientId, status: "OPEN" },
    });
    if (!episode) throw new Error(`No OPEN episode for ${row.patientRef}`);
    let instance = await tx.programInstance.findUnique({ where: { episodeId: episode.id } });
    if (!instance) {
      const code = episode.programCode || "CUTOVER";
      let template = await tx.programTemplate.findFirst({ where: { code } });
      if (!template) {
        template = await tx.programTemplate.create({
          data: { code, name: code, durationDays: 14 },
        });
      }
      if (!template) throw new Error(`Could not resolve program template ${code}`);
      instance = await tx.programInstance.create({
        data: {
          templateId: template.id,
          episodeId: episode.id,
          programCode: code,
          startsOn: new Date(),
          endsOn: new Date(Date.now() + 14 * 86400000),
        },
      });
    }
    if (!instance) throw new Error(`Could not resolve program instance for ${row.patientRef}`);
    const line = await tx.programProcedureBalance.findUnique({
      where: {
        instanceId_procedureCode: { instanceId: instance.id, procedureCode: row.procedureCode },
      },
    });
    if (line) {
      await tx.programProcedureBalance.update({
        where: { id: line.id },
        data: { quotaTotal: row.quotaTotal, quotaUsed: used },
      });
      return "updated";
    }
    await tx.programProcedureBalance.create({
      data: {
        instanceId: instance.id,
        procedureCode: row.procedureCode,
        quotaTotal: row.quotaTotal,
        quotaUsed: used,
      },
    });
    return "created";
  },
};

const slotsAdapter: ImportAdapter<{
  externalRef: string;
  date: string;
  startTime: string;
  patientRef: string;
  procedureCode: string;
  roomCode: string;
  status: string;
}> = {
  entity: "slots",
  label: "Slots",
  order: 41,
  templateHint: "06-slots.xlsx",
  headerAliases: aliases(
    "externalRef",
    "date",
    "startTime",
    "patientRef",
    "procedureCode",
    "roomCode",
    "status",
  ),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    date: z.string().min(1),
    startTime: z.string(),
    patientRef: z.string().min(1),
    procedureCode: z.string().min(1),
    roomCode: z.string(),
    status: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    date: req(raw.date),
    startTime: cellString(raw.startTime) ?? "09:00:00",
    patientRef: req(raw.patientRef),
    procedureCode: req(raw.procedureCode),
    roomCode: cellString(raw.roomCode) ?? "",
    status: cellString(raw.status) ?? "SCHEDULED",
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    const proc = await tx.procedureType.findFirst({ where: { code: row.procedureCode } });
    const resource = row.roomCode
      ? await tx.resource.findFirst({ where: { code: row.roomCode } })
      : null;
    const hhmm = row.startTime.length === 5 ? `${row.startTime}:00` : row.startTime;
    const start = new Date(`${row.date}T${hhmm}`);
    const st = row.status.toUpperCase();
    const historical = st === "COMPLETED" || st === "IMPORTED_DONE";
    return upsertByRef(
      tx,
      "slots",
      row.externalRef,
      dryRun,
      async () =>
        (
          await tx.procedureOrder.create({
            data: {
              patientRefId: patientId,
              procedureTypeId: proc?.id,
              procedureCode: row.procedureCode,
              procedureName: proc?.name ?? row.procedureCode,
              scheduledAt: start,
              endsAt: new Date(start.getTime() + (proc?.durationMin ?? 10) * 60000),
              status: historical ? "COMPLETED" : "SCHEDULED",
              completedAt: historical ? start : null,
              importedHistorical: historical,
              patientOrigin: "IN_HOUSE",
              resourceId: resource?.id,
              amountNet: 0,
            },
          })
        ).id,
      async (id) => {
        await tx.procedureOrder.update({
          where: { id },
          data: {
            scheduledAt: start,
            status: historical ? "COMPLETED" : "SCHEDULED",
            importedHistorical: historical,
            resourceId: resource?.id,
          },
        });
      },
    );
  },
};

async function ensureModality(tx: ImportTx, code: string, kind: string, title: string) {
  const existing = await tx.modality.findFirst({ where: { code } });
  if (existing) return existing;
  return tx.modality.create({
    data: { code, kind, titleEn: title, titleRu: title, titleAz: title },
  });
}

const labCatalogAdapter: ImportAdapter<{
  externalRef: string;
  code: string;
  name: string;
  group: string;
}> = {
  entity: "lab-catalog",
  label: "Lab catalog",
  order: 50,
  templateHint: "07-lab-catalog.xlsx",
  headerAliases: aliases("externalRef", "code", "name", "group"),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    group: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    code: req(raw.code),
    name: req(raw.name),
    group: cellString(raw.group) ?? "lab",
  }),
  upsert: (tx, row, dryRun) =>
    upsertByRef(
      tx,
      "lab-catalog",
      row.externalRef,
      dryRun,
      async () => {
        const modality = await ensureModality(tx, "LAB", "LAB", "Laboratory");
        return (
          await tx.diagnosticService.create({
            data: {
              code: row.code,
              modalityId: modality.id,
              category: row.group,
              kind: "LAB",
              titleEn: row.name,
              titleRu: row.name,
              titleAz: row.name,
              serviceCode: row.code,
            },
          })
        ).id;
      },
      async (id) => {
        await tx.diagnosticService.update({
          where: { id },
          data: { titleEn: row.name, titleRu: row.name, titleAz: row.name, category: row.group },
        });
      },
    ),
};

const labOrdersAdapter: ImportAdapter<{
  externalRef: string;
  patientRef: string;
  testCode: string;
  status: string;
  resultText: string;
  takenAt: string;
  fileRel: string;
}> = {
  entity: "lab-orders",
  label: "Lab orders",
  order: 51,
  templateHint: "08-lab-orders.xlsx",
  headerAliases: aliases(
    "externalRef",
    "patientRef",
    "testCode",
    "status",
    "resultText",
    "takenAt",
    "fileRel",
  ),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    patientRef: z.string().min(1),
    testCode: z.string().min(1),
    status: z.string(),
    resultText: z.string(),
    takenAt: z.string(),
    fileRel: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    patientRef: req(raw.patientRef),
    testCode: req(raw.testCode),
    status: cellString(raw.status) ?? "ORDERED",
    resultText: cellString(raw.resultText) ?? "",
    takenAt: cellString(raw.takenAt) ?? "",
    fileRel: cellString(raw.fileRel) ?? "",
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    const svc = await tx.diagnosticService.findFirst({ where: { code: row.testCode } });
    const done = row.status.toUpperCase() === "COMPLETED";
    const resultJson = JSON.stringify({
      note: row.resultText || null,
      fileRel: row.fileRel || null,
    });
    return upsertByRef(
      tx,
      "lab-orders",
      row.externalRef,
      dryRun,
      async () =>
        (
          await tx.labOrder.create({
            data: {
              patientRefId: patientId,
              testCode: row.testCode,
              status: done ? "COMPLETED" : "ORDERED",
              resultJson,
              collectedAt: parseDateCell(row.takenAt),
              resultDate: parseDateCell(row.takenAt),
              items: {
                create: { serviceCode: row.testCode, diagnosticServiceId: svc?.id },
              },
            },
          })
        ).id,
      async (id) => {
        await tx.labOrder.update({
          where: { id },
          data: { resultJson, testCode: row.testCode },
        });
      },
    );
  },
};

const diagnosticsAdapter: ImportAdapter<{
  externalRef: string;
  patientRef: string;
  code: string;
  name: string;
  resultText: string;
  takenAt: string;
}> = {
  entity: "diagnostics",
  label: "Diagnostics",
  order: 52,
  templateHint: "09-diagnostics.xlsx",
  headerAliases: aliases("externalRef", "patientRef", "code", "name", "resultText", "takenAt"),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    patientRef: z.string().min(1),
    code: z.string().min(1),
    name: z.string(),
    resultText: z.string(),
    takenAt: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    patientRef: req(raw.patientRef),
    code: req(raw.code),
    name: cellString(raw.name) ?? "",
    resultText: cellString(raw.resultText) ?? "",
    takenAt: cellString(raw.takenAt) ?? "",
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    return upsertByRef(
      tx,
      "diagnostics",
      row.externalRef,
      dryRun,
      async () => {
        const modality = await ensureModality(tx, "USG", "USG", "Ultrasound");
        let svc = await tx.diagnosticService.findFirst({ where: { code: row.code } });
        if (!svc) {
          svc = await tx.diagnosticService.create({
            data: {
              code: row.code,
              modalityId: modality.id,
              category: "imaging",
              kind: "USG",
              titleEn: row.name || row.code,
              titleRu: row.name || row.code,
              titleAz: row.name || row.code,
              serviceCode: row.code,
            },
          });
        }
        if (!svc) throw new Error(`Could not resolve diagnostic service ${row.code}`);
        return (
          await tx.labOrder.create({
            data: {
              patientRefId: patientId,
              testCode: row.code,
              status: "COMPLETED",
              resultJson: JSON.stringify({ note: row.resultText || null, kind: "USG" }),
              collectedAt: parseDateCell(row.takenAt),
              items: { create: { serviceCode: row.code, diagnosticServiceId: svc.id } },
            },
          })
        ).id;
      },
      async (id) => {
        await tx.labOrder.update({
          where: { id },
          data: { resultJson: JSON.stringify({ note: row.resultText || null, kind: "USG" }) },
        });
      },
    );
  },
};

const diagnosesAdapter: ImportAdapter<{
  patientRef: string;
  rawText: string;
  icd10: string;
  recordedAt: string;
}> = {
  entity: "diagnoses",
  label: "Diagnoses",
  order: 60,
  templateHint: "10-diagnoses.xlsx",
  headerAliases: aliases("patientRef", "rawText", "icd10", "recordedAt"),
  rowSchema: z.object({
    patientRef: z.string().min(1),
    rawText: z.string().min(1),
    icd10: z.string(),
    recordedAt: z.string(),
  }),
  mapRow: (raw) => ({
    patientRef: req(raw.patientRef),
    rawText: req(raw.rawText),
    icd10: cellString(raw.icd10) ?? "",
    recordedAt: cellString(raw.recordedAt) ?? "",
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    const episode = await tx.clinicalEpisode.findFirst({
      where: { patientRefId: patientId, status: "OPEN" },
    });
    if (!episode) throw new Error(`No OPEN episode for ${row.patientRef}`);
    const key = `wo:dx:${row.patientRef}:${row.recordedAt}:${row.rawText.slice(0, 24)}`;
    return upsertByRef(
      tx,
      "diagnoses",
      key,
      dryRun,
      async () => {
        const complaint = await tx.clinicalComplaint.create({
          data: { episodeId: episode.id, text: row.rawText },
        });
        if (row.icd10) {
          const icd = await tx.icdCode.findFirst({
            where: { code: row.icd10, selectable: true, active: true },
          });
          if (icd) {
            await tx.clinicalDiagnosis.create({
              data: { episodeId: episode.id, icdCodeId: icd.id, note: row.rawText },
            });
          }
        }
        return complaint.id;
      },
      async (id) => {
        await tx.clinicalComplaint.update({ where: { id }, data: { text: row.rawText } });
      },
    );
  },
};

const ADAPTERS = [
  proceduresAdapter,
  roomsAdapter,
  practitionersAdapter,
  patientsAdapter,
  quotasAdapter,
  slotsAdapter,
  labCatalogAdapter,
  labOrdersAdapter,
  diagnosticsAdapter,
  diagnosesAdapter,
] as ImportAdapter<unknown>[];

const byEntity = new Map(ADAPTERS.map((a) => [a.entity, a]));

export function getImportAdapter(entity: string): ImportAdapter<unknown> | undefined {
  return byEntity.get(entity);
}

export function listImportEntities(): ImportEntityMeta[] {
  return ADAPTERS.map(({ entity, label, order, templateHint, fileless }) => ({
    entity,
    label,
    order,
    templateHint,
    fileless,
  })).sort((a, b) => a.order - b.order);
}
