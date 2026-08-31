import { z } from "zod";
import type { ImportAdapter, ImportEntityMeta, ImportTx, UpsertOutcome } from "@/lib/import/types";
import { cellBool, cellNumber, cellString, parseDateCell } from "@/lib/import/helpers";
import { bindImportRecord, findImportRecordId } from "@/lib/import/keys";
import { requestOrganizationId } from "@/lib/request-organization";
import { applyNahiyeToProcedureOrder } from "@/domain/physio/nahiye-cutover.service";
import { resolveCutoverPatientMdm } from "@/lib/import/cutover-patient-mdm";
import { cutoverEpisodeFromCheckout } from "@/lib/import/cutover-episode-status";
import { ensureCutoverAttendingVisit } from "@/lib/import/cutover-attending-visit";
import { parseWoUsgNoteWithFallback, withRawQeydFallback, type WoUsgResultLine, type WoUsgServiceCode } from "@/lib/import/parse-wo-usg-note";
import { parseBakuDateTime } from "@/lib/baku-day";
import {
  isSeedProcedureCode,
  matchProcedureToSeed,
  matchRoomToSeed,
} from "@/lib/import/seed-catalog-match";
import {
  allocatePatientRefCode,
  composeFullName,
  isClinicPatientRefCode,
} from "@/domain/patient/patient-ref-code";

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

async function resolveImportedProcedure(
  tx: ImportTx,
  procedureCode: string,
): Promise<{ id: string; code: string; name: string; durationMin: number } | null> {
  const byCode = await tx.procedureType?.findFirst({ where: { code: procedureCode } });
  if (byCode) return byCode;
  const m = procedureCode.match(/^WO-TR-(\d+)$/i);
  if (!m) return null;
  const id = await findImportRecordId(tx, "procedures", `wo:treatment:${m[1]}`);
  if (!id) return null;
  return tx.procedureType.findFirst({ where: { id } });
}

async function resolveImportedResource(tx: ImportTx, roomCode: string) {
  const byCode = await tx.resource.findFirst({ where: { code: roomCode } });
  if (byCode) return byCode;
  const m = roomCode.match(/^WO-ROOM-(\d+)$/i);
  if (!m) return null;
  const roomId = await findImportRecordId(tx, "rooms", `wo:room:${m[1]}`);
  if (!roomId) return null;
  return tx.resource.findFirst({ where: { roomId } });
}

async function stampCutoverStayWindow(
  tx: ImportTx,
  episodeId: string | undefined,
  checkIn: Date | null,
  checkOut: Date | null,
) {
  if (!episodeId || (!checkIn && !checkOut)) return;
  const inst = await tx.programInstance?.findUnique({ where: { episodeId } });
  if (!inst) return;
  await tx.programInstance.update({
    where: { id: inst.id },
    data: {
      ...(checkIn ? { startsOn: checkIn } : {}),
      ...(checkOut ? { endsOn: checkOut } : {}),
    },
  });
}

/**
 * LabOrderItem is not tenant-scoped. Nested `items.create` under LabOrder is stamped
 * with organizationId and rejected. Top-level item create is UncheckedCreateInput:
 * scalar `diagnosticServiceId` + `labOrderId`, not `diagnosticService.connect`.
 */
async function createImportedLabOrder(
  tx: ImportTx,
  input: {
    patientId: string;
    testCode: string;
    status: "COMPLETED" | "ORDERED";
    resultJson: string;
    collectedAt: Date | null | undefined;
    resultDate?: Date | null;
    diagnosticServiceId?: string | null;
  },
): Promise<string> {
  const episode = await ensureCutoverEpisode(tx, input.patientId);
  const order = await tx.labOrder.create({
    data: {
      organizationId: orgId(),
      patientRefId: input.patientId,
      clinicalEpisodeId: episode.id,
      testCode: input.testCode,
      status: input.status,
      resultJson: input.resultJson,
      collectedAt: input.collectedAt,
      ...(input.collectedAt ? { createdAt: input.collectedAt } : {}),
      ...(input.status === "COMPLETED" && input.collectedAt
        ? { completedAt: input.collectedAt }
        : {}),
      ...(input.resultDate ? { resultDate: input.resultDate } : {}),
    },
  });
  await tx.labOrderItem.create({
    data: {
      labOrderId: order.id,
      serviceCode: input.testCode,
      ...(input.diagnosticServiceId ? { diagnosticServiceId: input.diagnosticServiceId } : {}),
    },
  });
  return order.id;
}

async function persistImagingResultLines(
  tx: ImportTx,
  orderId: string,
  lines: WoUsgResultLine[],
): Promise<void> {
  const item = await tx.labOrderItem.findFirst({ where: { labOrderId: orderId } });
  if (!item) throw new Error(`Lab order ${orderId} has no item`);
  const keep = new Set(lines.map((l) => l.code));
  await tx.labResult.deleteMany({
    where: { labOrderItemId: item.id, NOT: { code: { in: [...keep] } } },
  });
  for (const line of lines) {
    const existing = await tx.labResult.findUnique({
      where: { labOrderItemId_code: { labOrderItemId: item.id, code: line.code } },
    });
    const data = { label: line.label, value: line.value };
    if (existing) {
      await tx.labResult.update({ where: { id: existing.id }, data });
    } else {
      await tx.labResult.create({
        data: { labOrderItemId: item.id, code: line.code, ...data },
      });
    }
  }
}

function parseDiagnosticResultJson(raw: string): WoUsgResultLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is WoUsgResultLine =>
        Boolean(row && typeof row === "object" && typeof (row as WoUsgResultLine).code === "string"),
      )
      .map((row) => ({
        code: row.code,
        label: row.label || row.code,
        value: String(row.value ?? ""),
      }))
      .filter((row) => row.value);
  } catch {
    return [];
  }
}

/** WO patients grid has no lab date; LabResult.resultDate → takenAt. Else stay check-in. */
async function resolveImportedLabAt(
  tx: ImportTx,
  patientId: string,
  takenAt: Date | null,
): Promise<Date> {
  if (takenAt && !Number.isNaN(takenAt.getTime())) return takenAt;
  const episode = await tx.clinicalEpisode.findFirst({
    where: { patientRefId: patientId },
    orderBy: { openedAt: "desc" },
    select: { openedAt: true },
  });
  if (episode?.openedAt) return episode.openedAt;
  return new Date();
}

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
  order: 4,
  templateHint: "19-Treatments.xlsx — WO clinic/reports/01-procedures.xlsx",
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
      async () => {
        const catalog = await tx.procedureType.findMany({
          where: { code: { startsWith: "SVC-" } },
          select: { id: true, code: true, name: true },
        });
        const seed =
          matchProcedureToSeed(row.nameAz, catalog) ?? matchProcedureToSeed(row.code, catalog);
        if (seed) return seed.id;
        return (
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
        ).id;
      },
      async (id) => {
        const existing = await tx.procedureType.findFirst({
          where: { id },
          select: { code: true },
        });
        if (existing && isSeedProcedureCode(existing.code)) return;
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
  order: 5,
  templateHint: "20-Clinic-Rooms.xlsx — WO rooms catalog + SSOT cabinets",
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
        const cabs = await tx.room.findMany({
          where: { code: { startsWith: "CAB-" } },
          select: { id: true, code: true, name: true },
        });
        const seed = matchRoomToSeed(row.name, cabs) ?? matchRoomToSeed(row.code, cabs);
        if (seed) return seed.id;
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
        const existing = await tx.room.findFirst({ where: { id }, select: { code: true } });
        if (existing?.code?.startsWith("CAB-")) return;
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
  order: 6,
  templateHint: "21-Procedure-Requirements.xlsx — WO 01-procedures cabinets",
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
    const proc = await resolveImportedProcedure(tx, row.procedureCode);
    if (!proc) throw new Error(`Unknown procedure ${row.procedureCode}`);
    const resource =
      (await tx.resource.findFirst({
        where: { organizationId: orgId(), code: row.resourceCode },
      })) ?? (await resolveImportedResource(tx, row.resourceCode));
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
              resourceCode: resource.code ?? row.resourceCode,
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
            resourceCode: resource.code ?? row.resourceCode,
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
  order: 7,
  templateHint: "22-Doctors.xlsx — WO 27-practitioners-roster.json + HR",
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
  passport: string;
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
  order: 9,
  templateHint: "24-Patients.xlsx — WO dump cards + bulk/patients.json",
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
    "passport",
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
    passport: z.string(),
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
    passport: optCell(raw, "passport"),
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
          passport: row.passport,
        });
        const patient = await tx.patientRef.create({
          data: {
            organizationId: orgId(),
            refCode: await allocatePatientRefCode(tx, orgId()),
            givenName: row.givenName?.trim() || row.fullName.trim().split(/\s+/)[0] || row.fullName,
            surname:
              row.surname?.trim() ||
              row.fullName.trim().split(/\s+/).slice(-1)[0] ||
              "",
            fatherName: null,
            fullName:
              row.fullName ||
              composeFullName({
                givenName: row.givenName,
                surname: row.surname,
              }),
            sex,
            birthDate: parseDateCell(row.birthDate),
            nationality: row.nationality || null,
            phone: row.phone || null,
            globalPersonId,
            anamnesisText: "Nafta cutover import",
            anamnesisUpdatedAt: new Date(),
          },
        });
        const episode = await tx.clinicalEpisode.create({
          data: {
            organizationId: orgId(),
            patientRefId: patient.id,
            roomNumber: row.roomNumber || null,
            reservationId: row.hotelResNo || null,
            programCode: row.programCode || null,
            patientOrigin: inHouse ? "IN_HOUSE" : "WALK_IN",
            status: episodeState.status,
            globalPersonId,
            anamnesisText: "Nafta cutover import",
            anamnesisUpdatedAt: new Date(),
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
          clinicalEpisodeId: episode.id,
        });
        await stampCutoverStayWindow(tx, episode.id, checkIn, checkOut);
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
          passport: row.passport,
          existingGlobalPersonId: existing?.globalPersonId,
        });
        await tx.patientRef.update({
          where: { id },
          data: {
            fullName: row.fullName,
            ...(row.givenName?.trim()
              ? { givenName: row.givenName.trim() }
              : {}),
            ...(row.surname?.trim() ? { surname: row.surname.trim() } : {}),
            sex,
            birthDate: parseDateCell(row.birthDate),
            ...(row.nationality ? { nationality: row.nationality } : {}),
            ...(row.phone ? { phone: row.phone } : {}),
            ...(globalPersonId ? { globalPersonId } : {}),
            // Never overwrite clinic-native P-* refCode with WO externalRef
          },
        });
        const existingRef = await tx.patientRef.findUnique({
          where: { id },
          select: { refCode: true },
        });
        if (existingRef && !isClinicPatientRefCode(existingRef.refCode)) {
          const nextCode = await allocatePatientRefCode(tx, orgId());
          await tx.patientRef.update({
            where: { id },
            data: { refCode: nextCode },
          });
        }
        const checkIn = parseDateCell(row.checkIn);
        const checkOut = parseDateCell(row.checkOut);
        const episodeState = cutoverEpisodeFromCheckout(checkOut);
        const inHouse = row.isReservationPatient !== "false";
        const existingEpisode = await tx.clinicalEpisode.findFirst({
          where: { patientRefId: id },
          orderBy: { openedAt: "desc" },
        });
        const patientOrigin = inHouse ? ("IN_HOUSE" as const) : ("WALK_IN" as const);
        const episodeFields = {
          roomNumber: row.roomNumber || existingEpisode?.roomNumber || null,
          reservationId: row.hotelResNo || existingEpisode?.reservationId || null,
          programCode: row.programCode || existingEpisode?.programCode || null,
          patientOrigin,
          status: episodeState.status,
          closedAt: episodeState.closedAt,
          ...(checkIn ? { openedAt: checkIn } : {}),
          ...(globalPersonId ? { globalPersonId } : {}),
        };
        let episodeId = existingEpisode?.id;
        if (existingEpisode) {
          await tx.clinicalEpisode.update({
            where: { id: existingEpisode.id },
            data: episodeFields,
          });
        } else {
          const created = await tx.clinicalEpisode.create({
            data: {
              organizationId: orgId(),
              patientRefId: id,
              ...episodeFields,
            },
          });
          episodeId = created.id;
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
          patientOrigin,
          clinicalEpisodeId: episodeId,
        });
        await stampCutoverStayWindow(tx, episodeId, checkIn, checkOut);
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
  order: 10,
  templateHint: "25-Quotas.xlsx — derived from WO calendar (not EW)",
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
          startsOn: episode.openedAt ?? new Date(),
          endsOn:
            episode.closedAt ??
            new Date((episode.openedAt ?? new Date()).getTime() + 14 * 86400000),
        },
      });
    }
    if (!instance) throw new Error(`Could not resolve program instance for ${row.patientRef}`);
    const proc = await resolveImportedProcedure(tx, row.procedureCode);
    const procedureCode = proc?.code ?? row.procedureCode;
    const line = await tx.programProcedureBalance.findUnique({
      where: {
        instanceId_procedureCode: { instanceId: instance.id, procedureCode },
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
        procedureCode,
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
  order: 11,
  templateHint: "26-Slots-p01.xlsx … — WO calendar COMPLETED, 5k-row chunks",
  allowMultiple: true,
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
    const proc = await resolveImportedProcedure(tx, row.procedureCode);
    const resource = row.roomCode ? await resolveImportedResource(tx, row.roomCode) : null;
    const hhmm = row.startTime.length === 5 ? `${row.startTime}:00` : row.startTime.slice(0, 8);
    const start = parseBakuDateTime(row.date, hhmm);
    const st = row.status.toUpperCase();
    const pastAppointment = start.getTime() < Date.now();
    const historical = st === "COMPLETED" || st === "IMPORTED_DONE" || pastAppointment;
    const endsAt = new Date(start.getTime() + (proc?.durationMin ?? 10) * 60000);
    return upsertByRef(
      tx,
      "slots",
      row.externalRef,
      dryRun,
      async () => {
        const episode = await ensureCutoverEpisode(tx, patientId);
        const created = await tx.procedureOrder.create({
          data: {
            organizationId: orgId(),
            patientRefId: patientId,
            clinicalEpisodeId: episode.id,
            procedureTypeId: proc?.id,
            procedureCode: proc?.code ?? row.procedureCode,
            procedureName: proc?.name ?? row.procedureCode,
            scheduledAt: start,
            endsAt,
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
        const episode = await ensureCutoverEpisode(tx, patientId);
        await tx.procedureOrder.update({
          where: { id },
          data: {
            scheduledAt: start,
            endsAt,
            status: historical ? "COMPLETED" : "SCHEDULED",
            importedHistorical: historical,
            resourceId: resource?.id,
            clinicalEpisodeId: episode.id,
            ...(proc
              ? { procedureTypeId: proc.id, procedureCode: proc.code, procedureName: proc.name }
              : {}),
            ...(historical ? { completedAt: start } : {}),
          },
        });
        await applyNahiyeToProcedureOrder(tx, id, {
          nahiye: row.nahiye,
          procedureName: proc?.name ?? row.procedureCode,
          procedureTypeId: proc?.id,
          existingNote: existing?.note,
          // Always rematch on re-Apply #23 (seed S catalog, Baku clock, aliases).
          replaceSites: true,
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
  order: 1,
  templateHint: "16-Diagnostic-Lab-Catalog.xlsx — clinic seed (not EW)",
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
  order: 12,
  templateHint: "27-Lab-Orders.xlsx — WO lab-results dump",
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
    const clinicalAt = await resolveImportedLabAt(tx, patientId, parseDateCell(row.takenAt));
    return upsertByRef(
      tx,
      "lab-orders",
      row.externalRef,
      dryRun,
      async () => {
        return createImportedLabOrder(tx, {
          patientId,
          testCode: row.testCode,
          status: done ? "COMPLETED" : "ORDERED",
          resultJson: JSON.stringify([]),
          collectedAt: clinicalAt,
          resultDate: clinicalAt,
          diagnosticServiceId: svc?.id,
        });
      },
      async (id) => {
        const episode = await ensureCutoverEpisode(tx, patientId);
        await tx.labOrder.update({
          where: { id },
          data: {
            testCode: row.testCode,
            status: done ? "COMPLETED" : "ORDERED",
            collectedAt: clinicalAt,
            resultDate: clinicalAt,
            createdAt: clinicalAt,
            clinicalEpisodeId: episode.id,
            ...(done ? { completedAt: clinicalAt } : {}),
          },
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
  order: 13,
  templateHint: "28-Lab-Results.xlsx — WO Word tables",
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
    const order = await tx.labOrder.findUnique({
      where: { id: orderId },
      select: { resultJson: true, publishedAt: true, completedAt: true, collectedAt: true },
    });
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
    const clinicalAt = order?.collectedAt ?? order?.completedAt ?? new Date();
    await tx.labOrder.update({
      where: { id: orderId },
      data: {
        resultJson: JSON.stringify(next),
        status: "COMPLETED",
        publishedAt: order?.publishedAt ?? clinicalAt,
        completedAt: order?.completedAt ?? clinicalAt,
      },
    });
    return existing ? "updated" : "created";
  },
};

const diagnosticsAdapter: ImportAdapter<{
  externalRef: string;
  patientRef: string;
  code: string;
  name: string;
  resultText: string;
  resultJson: string;
  takenAt: string;
}> = {
  entity: "diagnostics",
  label: "Diagnostics",
  order: 14,
  templateHint: "29-Diagnostics.xlsx — WO Müayinə Anketi (USG)",
  headerAliases: aliases("externalRef", "patientRef", "code", "name", "resultText", "resultJson", "takenAt"),
  rowSchema: z.object({
    externalRef: z.string().min(1),
    patientRef: z.string().min(1),
    code: z.string().min(1),
    name: z.string(),
    resultText: z.string(),
    resultJson: z.string(),
    takenAt: z.string(),
  }),
  mapRow: (raw) => ({
    externalRef: req(raw.externalRef),
    patientRef: req(raw.patientRef),
    code: req(raw.code),
    name: cellString(raw.name) ?? "",
    resultText: cellString(raw.resultText) ?? "",
    resultJson: cellString(raw.resultJson) ?? "",
    takenAt: cellString(raw.takenAt) ?? "",
  }),
  upsert: async (tx, row, dryRun) => {
    const patientId = await findImportRecordId(tx, "patients", row.patientRef);
    if (!patientId) throw new Error(`Unknown patient ${row.patientRef}`);
    const clinicalAt = await resolveImportedLabAt(tx, patientId, parseDateCell(row.takenAt));
    const serviceCode: WoUsgServiceCode | string =
      row.code === "USG" || row.code === "USM" ? "USG-ABD" : row.code;
    const fromBook = parseDiagnosticResultJson(row.resultJson);
    const lines: WoUsgResultLine[] = withRawQeydFallback(
      fromBook.length
        ? fromBook
        : parseWoUsgNoteWithFallback(serviceCode as WoUsgServiceCode, row.resultText),
      row.resultText,
    );
    const resultJson = JSON.stringify(lines);
    return upsertByRef(
      tx,
      "diagnostics",
      row.externalRef,
      dryRun,
      async () => {
        const modality = await ensureModality(tx, "USG", "imaging", "Ultrasound");
        let svc = await tx.diagnosticService.findFirst({ where: { code: serviceCode } });
        if (!svc) {
          svc = await tx.diagnosticService.create({
            data: {
              organizationId: orgId(),
              code: serviceCode,
              modalityId: modality.id,
              category: "imaging",
              kind: "imaging",
              titleEn: row.name || serviceCode,
              titleRu: row.name || serviceCode,
              titleAz: row.name || serviceCode,
              serviceCode,
            },
          });
        }
        if (!svc) throw new Error(`Could not resolve diagnostic service ${serviceCode}`);
        const id = await createImportedLabOrder(tx, {
          patientId,
          testCode: serviceCode,
          status: "COMPLETED",
          resultJson,
          collectedAt: clinicalAt,
          resultDate: clinicalAt,
          diagnosticServiceId: svc.id,
        });
        await persistImagingResultLines(tx, id, lines);
        return id;
      },
      async (id) => {
        const episode = await ensureCutoverEpisode(tx, patientId);
        await tx.labOrder.update({
          where: { id },
          data: {
            testCode: serviceCode,
            resultJson,
            collectedAt: clinicalAt,
            resultDate: clinicalAt,
            createdAt: clinicalAt,
            completedAt: clinicalAt,
            clinicalEpisodeId: episode.id,
          },
        });
        await persistImagingResultLines(tx, id, lines);
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
  order: 99,
  templateHint: "skip — leftover diagnoses (not Nafta Apply)",
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
    if (!row.icd10.trim()) {
      console.warn(
        `[diagnoses import] skip ${row.patientRef}: no ICD-10 for "${row.rawText.slice(0, 40)}"`,
      );
      return null;
    }
    const icd = await tx.icdCode.findFirst({
      where: { code: row.icd10.trim(), selectable: true, active: true },
    });
    if (!icd) {
      console.warn(
        `[diagnoses import] skip ${row.patientRef}: ICD ${row.icd10} not found`,
      );
      return null;
    }
    const episode = await ensureCutoverEpisode(tx, patientId);
    const key = `wo:dx:${row.patientRef}:${row.recordedAt}:${row.icd10}:${row.rawText.slice(0, 24)}`;
    return upsertByRef(
      tx,
      "diagnoses",
      key,
      dryRun,
      async () => {
        const diagnosis = await tx.clinicalDiagnosis.create({
          data: {
            episodeId: episode.id,
            icdCodeId: icd.id,
            note: row.rawText.trim() || null,
          },
        });
        return diagnosis.id;
      },
      async (id) => {
        await tx.clinicalDiagnosis.update({
          where: { id },
          data: { note: row.rawText.trim() || null, icdCodeId: icd.id },
        });
      },
    );
  },
};

const physioSitesAdapter: ImportAdapter<{
  code: string;
  kind: string;
  prikaz817: number | null;
  laterality: boolean;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  titleLa: string;
  boundary: string | null;
  coarse: string[];
  woAliases: string[];
  sortOrder: number;
}> = {
  entity: "physio-sites",
  label: "Physio sites",
  order: 2,
  templateHint: "17-Physio-Sites.xlsx — seed physio-zones-s.json (not EW)",
  headerAliases: aliases(
    "code",
    "kind",
    "prikaz817",
    "laterality",
    "titleAz",
    "titleRu",
    "titleEn",
    "titleLa",
    "boundary",
    "coarse",
    "woAliases",
    "sortOrder",
  ),
  rowSchema: z.object({
    code: z.string().min(1),
    kind: z.string(),
    prikaz817: z.number().nullable(),
    laterality: z.boolean(),
    titleAz: z.string().min(1),
    titleRu: z.string(),
    titleEn: z.string(),
    titleLa: z.string(),
    boundary: z.string().nullable(),
    coarse: z.array(z.string()),
    woAliases: z.array(z.string()),
    sortOrder: z.number(),
  }),
  mapRow: (raw) => {
    const split = (value: unknown) =>
      (cellString(value) ?? "")
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    return {
      code: req(raw.code).toUpperCase(),
      kind: cellString(raw.kind) ?? "USSR-817",
      prikaz817: cellNumber(raw.prikaz817),
      laterality: cellBool(raw.laterality),
      titleAz: req(raw.titleAz),
      titleRu: cellString(raw.titleRu) ?? "",
      titleEn: cellString(raw.titleEn) ?? "",
      titleLa: cellString(raw.titleLa) ?? "",
      boundary: cellString(raw.boundary),
      coarse: split(raw.coarse).map((s) => s.toUpperCase()),
      woAliases: split(raw.woAliases),
      sortOrder: cellNumber(raw.sortOrder) ?? 0,
    };
  },
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.physioSite.findUnique({
      where: { organizationId_code: { organizationId: orgId(), code: row.code } },
    });
    if (dryRun) return existing ? "updated" : "created";
    const site = await tx.physioSite.upsert({
      where: { organizationId_code: { organizationId: orgId(), code: row.code } },
      create: {
        organizationId: orgId(),
        code: row.code,
        kind: row.kind,
        prikaz817: row.prikaz817,
        laterality: row.laterality,
        titleAz: row.titleAz,
        titleRu: row.titleRu,
        titleEn: row.titleEn,
        titleLa: row.titleLa,
        boundary: row.boundary,
        coarse: row.coarse,
        sortOrder: row.sortOrder,
      },
      update: {
        kind: row.kind,
        prikaz817: row.prikaz817,
        laterality: row.laterality,
        titleAz: row.titleAz,
        titleRu: row.titleRu,
        titleEn: row.titleEn,
        titleLa: row.titleLa,
        boundary: row.boundary,
        coarse: row.coarse,
        sortOrder: row.sortOrder,
        active: true,
      },
    });
    await tx.physioSiteAlias.deleteMany({ where: { siteId: site.id } });
    if (row.woAliases.length) {
      await tx.physioSiteAlias.createMany({
        data: row.woAliases.map((alias) => ({
          organizationId: orgId(),
          siteId: site.id,
          alias: alias.toLowerCase(),
        })),
        skipDuplicates: true,
      });
    }
    return existing ? "updated" : "created";
  },
};

const programTemplatesAdapter: ImportAdapter<{
  templateCode: string;
  templateName: string;
  minNights: number;
  maxNights: number;
  durationDays: number;
  nights: number;
  procedureCode: string;
  procedureName: string;
  qty: number;
}> = {
  entity: "program-templates",
  label: "Program templates",
  order: 8,
  templateHint: "23-Program-Templates.xlsx — PDF package_inclusion (not EW)",
  headerAliases: aliases(
    "templateCode",
    "templateName",
    "minNights",
    "maxNights",
    "durationDays",
    "nights",
    "procedureCode",
    "procedureName",
    "qty",
  ),
  rowSchema: z.object({
    templateCode: z.string().min(1),
    templateName: z.string().min(1),
    minNights: z.number(),
    maxNights: z.number(),
    durationDays: z.number(),
    nights: z.number(),
    procedureCode: z.string().min(1),
    procedureName: z.string().min(1),
    qty: z.number(),
  }),
  mapRow: (raw) => ({
    templateCode: req(raw.templateCode).toUpperCase(),
    templateName: req(raw.templateName),
    minNights: cellNumber(raw.minNights) ?? 5,
    maxNights: cellNumber(raw.maxNights) ?? 21,
    durationDays: cellNumber(raw.durationDays) ?? 10,
    nights: cellNumber(raw.nights) ?? 0,
    procedureCode: req(raw.procedureCode),
    procedureName: req(raw.procedureName),
    qty: cellNumber(raw.qty) ?? 0,
  }),
  upsert: async (tx, row, dryRun) => {
    if (dryRun) return "updated";
    let template = await tx.programTemplate.findFirst({
      where: { organizationId: orgId(), code: row.templateCode },
    });
    if (!template) {
      template = await tx.programTemplate.create({
        data: {
          organizationId: orgId(),
          code: row.templateCode,
          name: row.templateName,
          durationDays: row.durationDays,
          minNights: row.minNights,
          maxNights: row.maxNights,
        },
      });
    } else {
      await tx.programTemplate.update({
        where: { id: template.id },
        data: {
          name: row.templateName,
          durationDays: row.durationDays,
          minNights: row.minNights,
          maxNights: row.maxNights,
        },
      });
    }
    if (!template) throw new Error(`Could not resolve program template ${row.templateCode}`);
    const line = await tx.programTemplateProcedure.findFirst({
      where: { templateId: template.id, procedureCode: row.procedureCode },
    });
    if (!line) {
      await tx.programTemplateProcedure.create({
        data: {
          templateId: template.id,
          procedureCode: row.procedureCode,
          procedureName: row.procedureName,
          quotaTotal: row.qty,
        },
      });
    } else if (row.qty > line.quotaTotal) {
      await tx.programTemplateProcedure.update({
        where: { id: line.id },
        data: { quotaTotal: row.qty, procedureName: row.procedureName },
      });
    }
    const knot = await tx.programTemplateQuotaKnot.findUnique({
      where: {
        templateId_nights_procedureCode: {
          templateId: template.id,
          nights: row.nights,
          procedureCode: row.procedureCode,
        },
      },
    });
    if (knot) {
      await tx.programTemplateQuotaKnot.update({
        where: { id: knot.id },
        data: { qty: row.qty },
      });
      return "updated";
    }
    await tx.programTemplateQuotaKnot.create({
      data: {
        templateId: template.id,
        nights: row.nights,
        procedureCode: row.procedureCode,
        qty: row.qty,
      },
    });
    return "created";
  },
};

const ADAPTERS = [
  labCatalogAdapter,
  physioSitesAdapter,
  proceduresAdapter,
  roomsAdapter,
  procedureRequirementsAdapter,
  programTemplatesAdapter,
  practitionersAdapter,
  patientsAdapter,
  quotasAdapter,
  slotsAdapter,
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
  return ADAPTERS.map(({ entity, label, order, templateHint, fileless, allowMultiple }) => ({
    entity,
    label,
    order,
    templateHint,
    fileless,
    allowMultiple,
  })).sort((a, b) => a.order - b.order);
}
