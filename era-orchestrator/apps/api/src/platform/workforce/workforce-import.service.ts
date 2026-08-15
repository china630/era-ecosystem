import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { WorkforceAbsenceKind, WorkforceEmploymentStatus } from "@era365/database";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAbsencesService } from "./workforce-absences.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceProvisionService } from "./workforce-provision.service";
import { WorkforceScopeService } from "./workforce-scope.service";

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

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().replace(/\s+/g, ""));
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase().replace(/\s+/g, ""));
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
      const hireDate = cols[iHire] ?? "";
      const satsRaw = iSats >= 0 ? cols[iSats] ?? "" : "";
      const label = fullName || globalPersonId || fin || `row ${index}`;

      if ((!fin && !globalPersonId) || !orgUnitName || !positionName || !hireDate) {
        errors++;
        results.push({
          index,
          status: "error",
          message: "Missing required field(s): need fin or globalPersonId, orgUnit, position, hireDate",
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
          message: `Invalid hireDate (YYYY-MM-DD): ${hireDate}`,
        });
        continue;
      }

      const satelliteKeys = satsRaw
        ? satsRaw
            .split(/[|;]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      if (dryRun) {
        created++;
        results.push({
          index,
          status: "created",
          message: `OK (dry-run): ${label} → ${unit.name}/${position.name}`,
        });
        continue;
      }

      try {
        let personId = globalPersonId;
        if (!personId) {
          const resolved = await this.mdm.workforceResolvePerson({
            organizationId,
            fin,
            fullName,
          });
          personId = resolved.globalPersonId;
        }
        const existing = await this.prisma.workforceEmployment.findFirst({
          where: {
            organizationId,
            globalPersonId: personId,
            status: WorkforceEmploymentStatus.ACTIVE,
          },
        });
        if (existing) {
          skipped++;
          results.push({
            index,
            status: "skipped",
            message: "Active employment already exists",
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
          message: `Hired ${label}`,
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
      const startDate = cols[iStart] ?? "";
      const endDate = cols[iEnd] ?? "";
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
