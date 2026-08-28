import { z } from "zod";
import type { ImportAdapter, ImportEntityMeta, ImportTx, UpsertOutcome } from "@/lib/import/types";
import { cellNumber, cellString, parseDateCell } from "@/lib/import/helpers";
import { bindImportRecord, findImportRecordId } from "@/lib/import/keys";
import { requestOrganizationId } from "@/lib/request-organization";
import { applyNahiyeToProcedureOrder } from "@/domain/physio/nahiye-cutover.service";
import { resolveCutoverPatientMdm } from "@/lib/import/cutover-patient-mdm";
import { cutoverEpisodeFromCheckout } from "@/lib/import/cutover-episode-status";
import { ensureCutoverAttendingVisit } from "@/lib/import/cutover-attending-visit";

function orgId(): string {
  return requestOrganizationId();
}

function aliases(...keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, k]));
}

/** Slots copy optional WO `nahiye` into ProcedureOrder.note and run the S matcher (CLI-49 W4). */

function req(value: unknown): string {
  const s = cellString(value);
  if (!s) throw new Error("Required cell is empty");
  return s;
}

/** Cutover import: attach clinical history to any episode (OPEN or CLOSED), create archive episode if missing. */
async function ensureCutoverEpisode(tx: ImportTx, patientId: string) {
  const existing = await tx.clinicalEpisode.findFirst({
    where: { patientRefId: patientId },
    orderBy: { openedAt: "desc" },
  });
  if (existing) return existing;
  return tx.clinicalEpisode.create({
    data: {
      organizationId: orgId(),
      patientRefId: patientId,
      patientOrigin: "IN_HOUSE",
      status: "CLOSED",
      programCode: "CUTOVER-ARCHIVE",
    },
  });
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
  templateHint: "25-Treatments.xlsx",
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
              organizationId: orgId(),
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
  templateHint: "26-Rooms.xlsx",
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
        const room = await tx.room.create({
          data: { organizationId: orgId(), code: row.code, name: row.name },
        });
        await tx.resource.create({
          data: {
            organizationId: orgId(),
            code: row.code,
            name: row.name,
            kind: "ROOM",
            roomId: room.id,
          },
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
            data: {
              organizationId: orgId(),
              code: row.code,
              name: row.name,
              kind: "ROOM",
              roomId: id,
            },
          });
        }
      },
    ),
};

const procedureRequirementsAdapter: ImportAdapter<{
  procedureCode: string;
  resourceCode: string;
  role: string;
  quantity: number;
}> = {
  entity: "procedure-requirements",
  label: "Procedure requirements",
  order: 12,
  templateHint: "40-Procedure-Requirements.xlsx",
  headerAliases: aliases("procedureCode", "resourceCode", "role", "quantity"),
  rowSchema: z.object({
    procedureCode: z.string().min(1),
    resourceCode: z.string().min(1),
    role: z.string().min(1),
    quantity: z.number(),
  }),
  mapRow: (raw) => ({
    procedureCode: req(raw.procedureCode),
    resourceCode: req(raw.resourceCode),
    role: (cellString(raw.role) ?? "LOCATION").toUpperCase(),
    quantity: cellNumber(raw.quantity) ?? 1,
  }),
  upsert: async (tx, row, dryRun) => {
    const proc = await tx.procedureType.findFirst({
      where: { organizationId: orgId(), code: row.procedureCode },
    });
    if (!proc) throw new Error(`Unknown procedure ${row.procedureCode}`);
    const resource = await tx.resource.findFirst({
      where: { organizationId: orgId(), code: row.resourceCode },
    });
    if (!resource) throw new Error(`Unknown resource ${row.resourceCode}`);
    const role =
      row.role === "LOCATION" || row.role === "EQUIPMENT" || row.role === "STAFF"
        ? row.role
        : "LOCATION";
    const ref = `proc-req:${row.procedureCode}:${row.resourceCode}:${role}`;
    return upsertByRef(
      tx,
      "procedure-requirements",
      ref,
      dryRun,
      async () =>
        (
          await tx.procedureTypeRequirement.create({
            data: {
              procedureTypeId: proc.id,
              role,
              resourceKind: role === "LOCATION" ? "ROOM" : role === "EQUIPMENT" ? "EQUIPMENT" : null,
              resourceCode: row.resourceCode,
              quantity: Math.max(1, row.quantity),
              staffMode: "HARD",
              required: true,
            },
          })
        ).id,
      async (id) => {
        await tx.procedureTypeRequirement.update({
          where: { id },
          data: {
            resourceCode: row.resourceCode,
            quantity: Math.max(1, row.quantity),
          },
        });
      },
    );
  },
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
  templateHint: "27-Doctors.xlsx",
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
              organizationId: orgId(),
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

function toPatientSex(raw: string): "MALE" | "FEMALE" | "OTHER" | "UNKNOWN" {
  if (raw === "MALE" || raw === "FEMALE" || raw === "OTHER") return raw;
  return "UNKNOWN";
}

function optCell(raw: Record<string, unknown>, key: string): string {
  return cellString(raw[key]) ?? "";
}

const patientsAdapter: ImportAdapter<{
  externalRef: string;
  woId: string;
  fullName: string;
  givenName: string;
  surname: string;
  sex: string;
  birthDate: string;
  nationality: string;
  phone: string;
  hotelResNo: string;
  roomNumber: string;
  folioPerson: string;
  uniqueId: string;
  checkIn: string;
  checkOut: string;
  treatmentDaysCount: string;
  nightCount: string;
  isReservationPatient: string;
  doctorId: string;
  doctorName: string;
  doctorFormCreatedAt: string;
  checkUpId: string;
  checkUpName: string;
  programCode: string;
  latestPainDegree: string;
  latestPainDegreeCreatedAt: string;
}> = {
  entity: "patients",
  label: "Patients",
  order: 30,
  templateHint: "21-patients.xlsx",
  headerAliases: aliases(
    "externalRef",
    "woId",
    "fullName",
    "givenName",
    "surname",
    "sex",
    "birthDate",
    "nationality",
    "phone",
    "hotelResNo",
    "roomNumber",
    "folioPerson",
    "uniqueId",
    "checkIn",
    "checkOut",
    "treatmentDaysCount",
    "nightCount",
    "isReservationPatient",
    "doctorId",
    "doctorName",
    "doctorFormCreatedAt",
    "checkUpId",
    "checkUpName",
    "programCode",
    "latestPainDegree",
    "latestPainDegreeCreatedAt",
  ),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    woId: z.string(),
    fullName: z.string().min(1),
    givenName: z.string(),
    surname: z.string(),
    sex: z.string(),
    birthDate: z.string(),
    nationality: z.string(),
    phone: z.string(),
    hotelResNo: z.string(),
    roomNumber: z.string(),
    folioPerson: z.string(),
    uniqueId: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
    treatmentDaysCount: z.string(),
    nightCount: z.string(),
    isReservationPatient: z.string(),
    doctorId: z.string(),
    doctorName: z.string(),
    doctorFormCreatedAt: z.string(),
    checkUpId: z.string(),
    checkUpName: z.string(),
    programCode: z.string(),
    latestPainDegree: z.string(),
    latestPainDegreeCreatedAt: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    woId: optCell(raw, "woId"),
    fullName: req(raw.fullName),
    givenName: optCell(raw, "givenName"),
    surname: optCell(raw, "surname"),
    sex: cellString(raw.sex) ?? "UNKNOWN",
    birthDate: optCell(raw, "birthDate"),
    nationality: optCell(raw, "nationality"),
    phone: optCell(raw, "phone"),
    hotelResNo: optCell(raw, "hotelResNo"),
    roomNumber: optCell(raw, "roomNumber"),
    folioPerson: optCell(raw, "folioPerson"),
    uniqueId: optCell(raw, "uniqueId"),
    checkIn: optCell(raw, "checkIn"),
    checkOut: optCell(raw, "checkOut"),
    treatmentDaysCount: optCell(raw, "treatmentDaysCount"),
    nightCount: optCell(raw, "nightCount"),
    isReservationPatient: optCell(raw, "isReservationPatient"),
    doctorId: optCell(raw, "doctorId"),
    doctorName: optCell(raw, "doctorName"),
    doctorFormCreatedAt: optCell(raw, "doctorFormCreatedAt"),
    checkUpId: optCell(raw, "checkUpId"),
    checkUpName: optCell(raw, "checkUpName"),
    programCode: optCell(raw, "programCode"),
    latestPainDegree: optCell(raw, "latestPainDegree"),
    latestPainDegreeCreatedAt: optCell(raw, "latestPainDegreeCreatedAt"),
  }),
  upsert: (tx, row, dryRun) =>
    upsertByRef(
      tx,
      "patients",
      row.externalRef,
      dryRun,
      async () => {
        const sex = toPatientSex(row.sex);
        const checkIn = parseDateCell(row.checkIn);
        const checkOut = parseDateCell(row.checkOut);
        const episodeState = cutoverEpisodeFromCheckout(checkOut);
        const inHouse = row.isReservationPatient !== "false";
        const globalPersonId = await resolveCutoverPatientMdm({
          fullName: row.fullName,
          givenName: row.givenName,
          surname: row.surname,
          phone: row.phone,
          nationality: row.nationality,
          sex,
          birthDate: row.birthDate,
          hotelResNo: row.hotelResNo,
          folioPerson: row.folioPerson,
        });
        const patient = await tx.patientRef.create({
          data: {
            organizationId: orgId(),
            refCode: row.externalRef.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48),
            fullName: row.fullName,
            sex,
            birthDate: parseDateCell(row.birthDate),
            nationality: row.nationality || "AZ",
            phone: row.phone || null,
            globalPersonId,
            anamnesisText: "Nafta cutover import",
            anamnesisUpdatedAt: new Date(),
          },
        });
        await tx.clinicalEpisode.create({
          data: {
            organizationId: orgId(),
            patientRefId: patient.id,
            roomNumber: row.roomNumber || null,
            reservationId: row.hotelResNo || null,
            programCode: row.programCode || null,
            patientOrigin: inHouse ? "IN_HOUSE" : "WALK_IN",
            status: episodeState.status,
            globalPersonId,
            ...(checkIn ? { openedAt: checkIn } : {}),
            ...(episodeState.closedAt ? { closedAt: episodeState.closedAt } : {}),
          },
        });
        await ensureCutoverAttendingVisit(tx, {
          patientRefId: patient.id,
          patientExternalRef: row.externalRef,
          doctorId: row.doctorId,
          checkIn,
          episodeStatus: episodeState.status,
          closedAt: episodeState.closedAt,
          roomNumber: row.roomNumber || null,
          reservationId: row.hotelResNo || null,
          patientOrigin: inHouse ? "IN_HOUSE" : "WALK_IN",
        });
        return patient.id;
      },
      async (id) => {
        const sex = toPatientSex(row.sex);
        const existing = await tx.patientRef.findUnique({
          where: { id },
          select: { globalPersonId: true },
        });
        const globalPersonId = await resolveCutoverPatientMdm({
          fullName: row.fullName,
          givenName: row.givenName,
          surname: row.surname,
          phone: row.phone,
          nationality: row.nationality,
          sex,
          birthDate: row.birthDate,
          hotelResNo: row.hotelResNo,
          folioPerson: row.folioPerson,
          existingGlobalPersonId: existing?.globalPersonId,
        });
        await tx.patientRef.update({
          where: { id },
          data: {
            fullName: row.fullName,
            sex,
            birthDate: parseDateCell(row.birthDate),
            ...(row.nationality ? { nationality: row.nationality } : {}),
            ...(row.phone ? { phone: row.phone } : {}),
            ...(globalPersonId ? { globalPersonId } : {}),
          },
        });
        const checkIn = parseDateCell(row.checkIn);
        const checkOut = parseDateCell(row.checkOut);
        const episodeState = cutoverEpisodeFromCheckout(checkOut);
        const inHouse = row.isReservationPatient !== "false";
        const episode = await tx.clinicalEpisode.findFirst({
          where: { patientRefId: id },
          orderBy: { openedAt: "desc" },
        });
        const episodeFields = {
          roomNumber: row.roomNumber || episode?.roomNumber || null,
          reservationId: row.hotelResNo || episode?.reservationId || null,
          programCode: row.programCode || episode?.programCode || null,
          patientOrigin: inHouse ? "IN_HOUSE" : "WALK_IN",
          status: episodeState.status,
          closedAt: episodeState.closedAt,
          ...(checkIn ? { openedAt: checkIn } : {}),
          ...(globalPersonId ? { globalPersonId } : {}),
        };
        if (episode) {
          await tx.clinicalEpisode.update({
            where: { id: episode.id },
            data: episodeFields,
          });
        } else {
          await tx.clinicalEpisode.create({
            data: {
              organizationId: orgId(),
              patientRefId: id,
              ...episodeFields,
            },
          });
        }
        await ensureCutoverAttendingVisit(tx, {
          patientRefId: id,
          patientExternalRef: row.externalRef,
          doctorId: row.doctorId,
          checkIn,
          episodeStatus: episodeState.status,
          closedAt: episodeState.closedAt,
          roomNumber: episodeFields.roomNumber,
          reservationId: episodeFields.reservationId,
          patientOrigin: inHouse ? "IN_HOUSE" : "WALK_IN",
        });
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
  templateHint: "38-quotas.xlsx",
  headerAliases: {
    patientRef: "patientRef",
    procedureCode: "procedureCode",
    quotaLeft: "quotaLeft",
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
    const episode = await ensureCutoverEpisode(tx, patientId);
    let instance = await tx.programInstance.findUnique({ where: { episodeId: episode.id } });
    if (!instance) {
      const code = episode.programCode || "CUTOVER";
      let template = await tx.programTemplate.findFirst({ where: { code } });
      if (!template) {
        template = await tx.programTemplate.create({
          data: { organizationId: orgId(), code, name: code, durationDays: 14 },
        });
      }
      if (!template) throw new Error(`Could not resolve program template ${code}`);
      instance = await tx.programInstance.create({
        data: {
          organizationId: orgId(),
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
  nahiye: string | null;
}> = {
  entity: "slots",
  label: "Slots",
  order: 41,
  templateHint: "23-slots.xlsx",
  headerAliases: {
    ...aliases(
      "externalRef",
      "date",
      "startTime",
      "patientRef",
      "procedureCode",
      "roomCode",
      "status",
      "nahiye",
    ),
    note: "nahiye",
    site: "nahiye",
  },
  rowSchema: z.object({
    externalRef: z.string().min(1),
    date: z.string().min(1),
    startTime: z.string(),
    patientRef: z.string().min(1),
    procedureCode: z.string().min(1),
    roomCode: z.string(),
    status: z.string(),
    nahiye: z.string().nullable(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    date: req(raw.date),
    startTime: cellString(raw.startTime) ?? "09:00:00",
    patientRef: req(raw.patientRef),
    procedureCode: req(raw.procedureCode),
    roomCode: cellString(raw.roomCode) ?? "",
    status: cellString(raw.status) ?? "SCHEDULED",
    nahiye: cellString(raw.nahiye),
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
      async () => {
        const created = await tx.procedureOrder.create({
          data: {
            organizationId: orgId(),
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
        });
        await applyNahiyeToProcedureOrder(tx, created.id, {
          nahiye: row.nahiye,
          procedureName: proc?.name ?? row.procedureCode,
          procedureTypeId: proc?.id,
          existingNote: null,
          replaceSites: true,
        });
        return created.id;
      },
      async (id) => {
        const existing = await tx.procedureOrder.findFirst({
          where: { id },
          include: { sites: true },
        });
        await tx.procedureOrder.update({
          where: { id },
          data: {
            scheduledAt: start,
            status: historical ? "COMPLETED" : "SCHEDULED",
            importedHistorical: historical,
            resourceId: resource?.id,
          },
        });
        await applyNahiyeToProcedureOrder(tx, id, {
          nahiye: row.nahiye,
          procedureName: proc?.name ?? row.procedureCode,
          procedureTypeId: proc?.id,
          existingNote: existing?.note,
          replaceSites: !existing?.sites.length,
        });
      },
    );
  },
};

async function ensureModality(tx: ImportTx, code: string, kind: string, title: string) {
  const existing = await tx.modality.findFirst({ where: { code } });
  if (existing) return existing;
  return tx.modality.create({
    data: {
      organizationId: orgId(),
      code,
      kind,
      titleEn: title,
      titleRu: title,
      titleAz: title,
    },
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
  templateHint: "29-Analyses.xlsx",
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
              organizationId: orgId(),
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
  panel: string;
  takenAt: string;
}> = {
  entity: "lab-orders",
  label: "Lab orders",
  order: 51,
  templateHint: "24-lab-orders.xlsx",
  headerAliases: aliases("externalRef", "patientRef", "testCode", "status", "panel", "takenAt"),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    patientRef: z.string().min(1),
    testCode: z.string().min(1),
    status: z.string(),
    panel: z.string(),
    takenAt: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    patientRef: req(raw.patientRef),
    testCode: req(raw.testCode),
    status: cellString(raw.status) ?? "ORDERED",
    panel: cellString(raw.panel) ?? "",
    takenAt: cellString(raw.takenAt) ?? "",
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    const svc = await tx.diagnosticService.findFirst({ where: { code: row.testCode } });
    const done = row.status.toUpperCase() === "COMPLETED";
    return upsertByRef(
      tx,
      "lab-orders",
      row.externalRef,
      dryRun,
      async () =>
        (
          await tx.labOrder.create({
            data: {
              organizationId: orgId(),
              patientRefId: patientId,
              testCode: row.testCode,
              status: done ? "COMPLETED" : "ORDERED",
              resultJson: JSON.stringify([]),
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
          data: { testCode: row.testCode, status: done ? "COMPLETED" : "ORDERED" },
        });
      },
    );
  },
};

const labResultsAdapter: ImportAdapter<{
  orderRef: string;
  code: string;
  label: string;
  value: string;
  unit: string;
  refMin: string;
  refMax: string;
}> = {
  entity: "lab-results",
  label: "Lab result fields",
  order: 52,
  templateHint: "39-lab-results.xlsx",
  headerAliases: aliases("orderRef", "code", "label", "value", "unit", "refMin", "refMax"),
  rowSchema: z.object({
    orderRef: z.string().min(1),
    code: z.string().min(1),
    label: z.string(),
    value: z.string().min(1),
    unit: z.string(),
    refMin: z.string(),
    refMax: z.string(),
  }),
  mapRow: (raw) => ({
    orderRef: req(raw.orderRef),
    code: req(raw.code),
    label: cellString(raw.label) ?? "",
    value: req(raw.value),
    unit: cellString(raw.unit) ?? "",
    refMin: cellString(raw.refMin) ?? "",
    refMax: cellString(raw.refMax) ?? "",
  }),
  upsert: async (tx, row, dryRun) => {
    const orderId = await findImportRecordId(tx, "lab-orders", row.orderRef);
    if (!orderId) throw new Error(`Unknown lab order ${row.orderRef}`);
    if (dryRun) return "created";
    const item = await tx.labOrderItem.findFirst({ where: { labOrderId: orderId } });
    if (!item) throw new Error(`Lab order ${row.orderRef} has no item`);
    const existing = await tx.labResult.findUnique({
      where: { labOrderItemId_code: { labOrderItemId: item.id, code: row.code } },
    });
    const data = {
      label: row.label || row.code,
      value: row.value,
      unit: row.unit || null,
      refMin: row.refMin || null,
      refMax: row.refMax || null,
    };
    if (existing) {
      await tx.labResult.update({ where: { id: existing.id }, data });
    } else {
      await tx.labResult.create({
        data: { labOrderItemId: item.id, code: row.code, ...data },
      });
    }
    const order = await tx.labOrder.findUnique({ where: { id: orderId }, select: { resultJson: true } });
    let lines: Array<Record<string, string>> = [];
    try {
      const parsed = JSON.parse(order?.resultJson || "[]");
      if (Array.isArray(parsed)) lines = parsed;
    } catch {
      lines = [];
    }
    const next = lines.filter((l) => l.code !== row.code);
    next.push({
      code: row.code,
      label: data.label,
      value: row.value,
      unit: row.unit,
      refMin: row.refMin,
      refMax: row.refMax,
    });
    await tx.labOrder.update({ where: { id: orderId }, data: { resultJson: JSON.stringify(next) } });
    return existing ? "updated" : "created";
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
  order: 53,
  templateHint: "31-Diagnostics.xlsx",
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
              organizationId: orgId(),
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
              organizationId: orgId(),
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
  templateHint: "32-Diagnoses.xlsx",
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
    const episode = await ensureCutoverEpisode(tx, patientId);
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
  procedureRequirementsAdapter,
  practitionersAdapter,
  patientsAdapter,
  quotasAdapter,
  slotsAdapter,
  labCatalogAdapter,
  labOrdersAdapter,
  labResultsAdapter,
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
