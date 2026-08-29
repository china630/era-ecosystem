import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { WorkforceAbsenceKind, WorkforceEmploymentStatus, OrgUnitStatus } from "@era365/database";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAbsencesService } from "./workforce-absences.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceOrgUnitsService } from "./workforce-org-units.service";
import { WorkforcePositionsService } from "./workforce-positions.service";
import { WorkforceProvisionService } from "./workforce-provision.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { normalizeDateOnly } from "./workforce-date";
import { rosterSatelliteKeys } from "./workforce-satellite-keys";

export type ImportRowResult = {
  index: number;
  status: "created" | "skipped" | "error";
  message: string;
};

export type ImportResult = {
  dryRun: boolean;
  created: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};

const ABSENCE_KINDS = new Set<string>(Object.values(WorkforceAbsenceKind));

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function foldHeader(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/i̇/g, "i")
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i");
}

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => foldHeader(h));
  for (const name of names) {
    const i = lower.indexOf(foldHeader(name));
    if (i >= 0) return i;
  }
  return -1;
}

function headerIndexContains(headers: string[], ...names: string[]): number {
  const exact = headerIndex(headers, ...names);
  if (exact >= 0) return exact;
  const lower = headers.map((h) => foldHeader(h));
  for (const name of names) {
    const n = foldHeader(name);
    if (n.length < 4) continue;
    const i = lower.findIndex((h) => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

function staffCodeFromEmployment(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

@Injectable()
export class WorkforceImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: MdmService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly provision: WorkforceProvisionService,
    private readonly absences: WorkforceAbsencesService,
    private readonly orgUnits: WorkforceOrgUnitsService,
    private readonly positions: WorkforcePositionsService,
  ) {}

  async importRoster(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<ImportResult> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const parsed = parseCsv(csvText);
    if (parsed.length < 2) {
      throw new BadRequestException("CSV must include a header and at least one data row");
    }
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iPerson = headerIndex(headers, "globalPersonId", "globalpersonid");
    const iName = headerIndex(headers, "fullName", "fullname", "displayname");
    const iUnit = headerIndex(headers, "orgUnit", "orgunit", "unit");
    const iPos = headerIndex(headers, "position");
    const iHire = headerIndex(headers, "hireDate", "hiredate");
    const iBirth = headerIndex(headers, "birthDate", "birthdate");
    const iSex = headerIndex(headers, "sex", "gender", "cins", "cinsi");
    const iWorkplace = headerIndex(headers, "workplace", "employmentkind");
    const iSats = headerIndex(headers, "satellites", "satelliteKeys", "satellitekeys");
    if ((iFin < 0 && iPerson < 0) || iUnit < 0 || iPos < 0 || iHire < 0) {
      throw new BadRequestException(
        "CSV header must include (fin or globalPersonId), orgUnit, position, hireDate. New hires also need fullName with fin.",
      );
    }

    const units = await this.prisma.orgUnit.findMany({
      where: { workforceScopeId: link.workforceScopeId, status: "ACTIVE" },
    });
    const positions = await this.prisma.workforcePosition.findMany({
      where: { orgUnit: { workforceScopeId: link.workforceScopeId } },
      include: { orgUnit: true },
    });

    const results: ImportRowResult[] = [];
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let r = 1; r < parsed.length; r++) {
      const cols = parsed[r];
      const index = r + 1;
      const fin = iFin >= 0 ? (cols[iFin] ?? "").trim().toUpperCase() : "";
      const globalPersonId =
        iPerson >= 0 ? (cols[iPerson] ?? "").trim() : "";
      const fullName = iName >= 0 ? (cols[iName] ?? "").trim() : "";
      const orgUnitName = cols[iUnit] ?? "";
      const positionName = cols[iPos] ?? "";
      const hireRaw = cols[iHire] ?? "";
      const hireDate = normalizeDateOnly(hireRaw);
      const birthDate =
        iBirth >= 0 ? normalizeDateOnly(cols[iBirth] ?? "") : "";
      const sex = iSex >= 0 ? (cols[iSex] ?? "").trim() : "";
      const workplace = (iWorkplace >= 0 ? (cols[iWorkplace] ?? "") : "")
        .trim()
        .toUpperCase();
      const satsRaw = iSats >= 0 ? cols[iSats] ?? "" : "";
      const label = fullName || globalPersonId || fin || `row ${index}`;

      if (!fin && !globalPersonId) {
        errors++;
        results.push({
          index,
          status: "error",
          message: "Missing required field(s): need fin or globalPersonId",
        });
        continue;
      }
      if (fin && !fullName) {
        errors++;
        results.push({
          index,
          status: "error",
          message: "fullName is required when hiring by fin",
        });
        continue;
      }

      let personId = globalPersonId;
      if (!dryRun && fullName) {
        try {
          const resolved = await this.mdm.workforceResolvePerson({
            organizationId,
            ...(globalPersonId ? { globalPersonId } : {}),
            fin,
            fullName,
            ...(birthDate ? { birthDate } : {}),
            ...(sex ? { sex } : {}),
          });
          personId = resolved.globalPersonId;
        } catch (err) {
          errors++;
          results.push({
            index,
            status: "error",
            message: err instanceof Error ? err.message : "MDM resolve failed",
          });
          continue;
        }
      }

      if (!orgUnitName || !positionName || !hireDate) {
        errors++;
        results.push({
          index,
          status: "error",
          message: hireRaw.trim() && !hireDate
            ? `Invalid hireDate (YYYY-MM-DD): ${hireRaw}`
            : "Missing required field(s): orgUnit, position, hireDate",
        });
        continue;
      }

      const unit = units.find(
        (u) =>
          u.name.toLowerCase() === orgUnitName.toLowerCase() ||
          (u.code != null && u.code.toLowerCase() === orgUnitName.toLowerCase()),
      );
      if (!unit) {
        errors++;
        results.push({
          index,
          status: "error",
          message: `Org unit not found: ${orgUnitName}`,
        });
        continue;
      }

      const position = positions.find(
        (p) =>
          p.orgUnitId === unit.id &&
          p.name.toLowerCase() === positionName.toLowerCase(),
      );
      if (!position) {
        errors++;
        results.push({
          index,
          status: "error",
          message: `Position not found in unit: ${positionName}`,
        });
        continue;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
        errors++;
        results.push({
          index,
          status: "error",
          message: `Invalid hireDate (YYYY-MM-DD): ${hireRaw || hireDate}`,
        });
        continue;
      }

      const satelliteKeys = rosterSatelliteKeys(workplace, satsRaw);

      if (dryRun) {
        created++;
        results.push({
          index,
          status: "created",
          message: `OK (dry-run): ${label} → ${unit.name}/${position.name}${
            satelliteKeys.length ? "" : " (headcount, no seat)"
          }`,
        });
        continue;
      }

      try {
        const existing = await this.prisma.workforceEmployment.findFirst({
          where: {
            organizationId,
            globalPersonId: personId,
            orgUnitId: unit.id,
            positionId: position.id,
            status: WorkforceEmploymentStatus.ACTIVE,
          },
        });
        if (existing) {
          const prevHire =
            existing.hireDate instanceof Date
              ? existing.hireDate.toISOString().slice(0, 10)
              : String(existing.hireDate ?? "").slice(0, 10);
          const notes = ["MDM updated"];
          if (hireDate && prevHire !== hireDate) {
            await this.prisma.workforceEmployment.update({
              where: { id: existing.id },
              data: { hireDate: new Date(`${hireDate}T00:00:00.000Z`) },
            });
            notes.push(`hireDate ${prevHire || "—"} → ${hireDate}`);
          }
          skipped++;
          results.push({
            index,
            status: "skipped",
            message: `Active employment already exists for this unit/position (${notes.join("; ")})`,
          });
          continue;
        }
        await this.provision.hire(organizationId, actorUserId, {
          globalPersonId: personId,
          hireDate,
          orgUnitId: unit.id,
          positionId: position.id,
          satelliteKeys,
        });
        created++;
        results.push({
          index,
          status: "created",
          message: satelliteKeys?.length
            ? `Hired ${label}`
            : `Hired ${label} (headcount, no seat)`,
        });
      } catch (err) {
        errors++;
        results.push({
          index,
          status: "error",
          message: err instanceof Error ? err.message : "Hire failed",
        });
      }
    }

    return { dryRun, created, skipped, errors, rows: results };
  }

  async importOrgStructure(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<ImportResult> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const parsed = parseCsv(csvText);
    if (parsed.length < 2) {
      throw new BadRequestException("CSV must include a header and at least one data row");
    }
    const headers = parsed[0];
    const iUnit = headerIndexContains(headers, "orgUnit", "orgunit", "unit", "şöbə", "soba");
    const iPos = headerIndexContains(headers, "position", "vəzifə", "vezife");
    const iSlots = headerIndexContains(
      headers,
      "totalSlots",
      "totalslots",
      "slots",
      "ştatvahidi",
      "statvahidi",
    );
    if (iUnit < 0 || iPos < 0) {
      throw new BadRequestException(
        "CSV header must include orgUnit and position (or Şöbə / Vəzifə)",
      );
    }

    const existingUnits = await this.prisma.orgUnit.findMany({
      where: { workforceScopeId: link.workforceScopeId },
    });
    const existingPositions = await this.prisma.workforcePosition.findMany({
      where: { orgUnit: { workforceScopeId: link.workforceScopeId } },
    });

    const results: ImportRowResult[] = [];
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const unitCache = [...existingUnits];
    const positionCache = [...existingPositions];

    for (let r = 1; r < parsed.length; r++) {
      const cols = parsed[r];
      const index = r + 1;
      const orgUnitName = (cols[iUnit] ?? "").trim();
      const positionName = (cols[iPos] ?? "").trim();
      const slotsRaw = iSlots >= 0 ? (cols[iSlots] ?? "").trim() : "";
      const slotsNum = Number(String(slotsRaw).replace(",", "."));
      const totalSlots =
        Number.isFinite(slotsNum) && slotsNum > 0 ? Math.max(1, Math.round(slotsNum)) : 1;

      if (!orgUnitName || !positionName) {
        errors++;
        results.push({
          index,
          status: "error",
          message: "Missing orgUnit or position",
        });
        continue;
      }

      if (dryRun) {
        created++;
        results.push({
          index,
          status: "created",
          message: `OK (dry-run): ${orgUnitName} / ${positionName} ×${totalSlots}`,
        });
        continue;
      }

      try {
        let unit = unitCache.find(
          (u) => u.name.toLowerCase() === orgUnitName.toLowerCase(),
        );
        const notes: string[] = [];
        if (!unit) {
          unit = await this.orgUnits.create(organizationId, actorUserId, {
            name: orgUnitName,
          });
          unitCache.push(unit);
          notes.push("org unit created");
        } else if (unit.status !== OrgUnitStatus.ACTIVE) {
          unit = await this.prisma.orgUnit.update({
            where: { id: unit.id },
            data: { status: OrgUnitStatus.ACTIVE },
          });
          const idx = unitCache.findIndex((u) => u.id === unit!.id);
          if (idx >= 0) unitCache[idx] = unit;
          notes.push("org unit reactivated");
        }

        const pos = positionCache.find(
          (p) =>
            p.orgUnitId === unit.id &&
            p.name.toLowerCase() === positionName.toLowerCase(),
        );
        if (!pos) {
          const createdPos = await this.positions.create(organizationId, actorUserId, {
            orgUnitId: unit.id,
            name: positionName,
            totalSlots,
          });
          positionCache.push(createdPos);
          notes.push("position created");
          created++;
          results.push({
            index,
            status: "created",
            message: `${orgUnitName} / ${positionName} ×${totalSlots} (${notes.join(", ")})`,
          });
          continue;
        }
        if (pos.totalSlots !== totalSlots) {
          await this.positions.update(organizationId, pos.id, actorUserId, {
            totalSlots,
          });
          pos.totalSlots = totalSlots;
          notes.push(`slots → ${totalSlots}`);
        }
        if (notes.length) {
          skipped++;
          results.push({
            index,
            status: "skipped",
            message: `${orgUnitName} / ${positionName} (${notes.join(", ")})`,
          });
        } else {
          skipped++;
          results.push({
            index,
            status: "skipped",
            message: `Already exists: ${orgUnitName} / ${positionName}`,
          });
        }
      } catch (err) {
        errors++;
        results.push({
          index,
          status: "error",
          message: err instanceof Error ? err.message : "Org structure import failed",
        });
      }
    }

    return { dryRun, created, skipped, errors, rows: results };
  }

  async importAbsences(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<ImportResult> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const parsed = parseCsv(csvText);
    if (parsed.length < 2) {
      throw new BadRequestException("CSV must include a header and at least one data row");
    }
    const headers = parsed[0];
    const iStaff = headerIndex(headers, "staffCode", "staffcode");
    const iPerson = headerIndex(headers, "globalPersonId", "globalpersonid");
    const iKind = headerIndex(headers, "kind");
    const iStart = headerIndex(headers, "startDate", "startdate");
    const iEnd = headerIndex(headers, "endDate", "enddate");
    const iNote = headerIndex(headers, "note");
    if ((iStaff < 0 && iPerson < 0) || iKind < 0 || iStart < 0 || iEnd < 0) {
      throw new BadRequestException(
        "CSV header must include staffCode or globalPersonId, kind, startDate, endDate",
      );
    }

    const employments = await this.prisma.workforceEmployment.findMany({
      where: { organizationId, status: WorkforceEmploymentStatus.ACTIVE },
    });
    const byStaff = new Map(
      employments.map((e) => [staffCodeFromEmployment(e.id), e] as const),
    );
    const byPerson = new Map(employments.map((e) => [e.globalPersonId, e] as const));

    const results: ImportRowResult[] = [];
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let r = 1; r < parsed.length; r++) {
      const cols = parsed[r];
      const index = r + 1;
      const staffCode = iStaff >= 0 ? (cols[iStaff] ?? "").toUpperCase() : "";
      const globalPersonId = iPerson >= 0 ? cols[iPerson] ?? "" : "";
      const kind = (cols[iKind] ?? "").toUpperCase();
      const startDate = normalizeDateOnly(cols[iStart] ?? "");
      const endDate = normalizeDateOnly(cols[iEnd] ?? "");
      const note = iNote >= 0 ? cols[iNote] ?? "" : "";

      const employment =
        (staffCode ? byStaff.get(staffCode) : undefined) ??
        (globalPersonId ? byPerson.get(globalPersonId) : undefined);

      if (!employment) {
        errors++;
        results.push({
          index,
          status: "error",
          message: `Employment not found (${staffCode || globalPersonId || "—"})`,
        });
        continue;
      }
      if (!ABSENCE_KINDS.has(kind)) {
        errors++;
        results.push({
          index,
          status: "error",
          message: `Invalid kind: ${kind}`,
        });
        continue;
      }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        errors++;
        results.push({
          index,
          status: "error",
          message: "Invalid date format (YYYY-MM-DD)",
        });
        continue;
      }

      if (dryRun) {
        created++;
        results.push({
          index,
          status: "created",
          message: `OK (dry-run): ${kind} ${startDate}–${endDate}`,
        });
        continue;
      }

      try {
        await this.absences.create(organizationId, actorUserId, {
          employmentId: employment.id,
          kind: kind as WorkforceAbsenceKind,
          startDate,
          endDate,
          note,
          submit: true,
        });
        created++;
        results.push({
          index,
          status: "created",
          message: `Absence ${kind} created`,
        });
      } catch (err) {
        errors++;
        results.push({
          index,
          status: "error",
          message: err instanceof Error ? err.message : "Absence create failed",
        });
      }
    }

    return { dryRun, created, skipped, errors, rows: results };
  }
}
