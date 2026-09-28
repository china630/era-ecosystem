import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import {
  WorkforceAbsenceKind,
  WorkforceAbsenceStatus,
  WorkforceEmploymentStatus,
  WorkforcePersonnelOrderStatus,
  WorkforcePersonnelOrderType,
} from "@era365/database";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceImportService } from "./workforce-import.service";
import { WorkforceProvisionService } from "./workforce-provision.service";
import { WorkforceRosterCache } from "./workforce-roster-cache";
import { WorkforceRosterService } from "./workforce-roster.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { FinanceWorkforceMirrorClient } from "./finance-workforce-mirror.client";
import { normalizeDateOnly } from "./workforce-date";
import { isoDayUtc } from "./roster-cycle.util";
import {
  brigadeCodeFromName,
  col,
  foldHeader,
  headerIndex,
  parseCsv,
  placeCodeFromName,
} from "./workforce-csv.util";
import {
  MIGRATION_DETAIL_LIMIT,
  MIGRATION_SOURCE,
  MIGRATION_STEPS,
  MIGRATION_FIELDS,
  type MigrationStepId,
  isMigrationStepId,
} from "./workforce-migration.constants";

export type MigrationRowResult = {
  index: number;
  status: "created" | "updated" | "skipped" | "error";
  message: string;
};

export type MigrationResult = {
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: MigrationRowResult[];
};

type Acc = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: MigrationRowResult[];
};

function emptyAcc(): Acc {
  return { created: 0, updated: 0, skipped: 0, errors: 0, rows: [] };
}

function finish(acc: Acc, dryRun: boolean): MigrationResult {
  return {
    dryRun,
    created: acc.created,
    updated: acc.updated,
    skipped: acc.skipped,
    errors: acc.errors,
    rows: acc.rows.slice(0, MIGRATION_DETAIL_LIMIT),
  };
}

function push(
  acc: Acc,
  index: number,
  status: MigrationRowResult["status"],
  message: string,
) {
  acc[status === "error" ? "errors" : status]++;
  acc.rows.push({ index, status, message });
}

function requireCsv(csvText: string) {
  if (!csvText.trim()) {
    throw new BadRequestException("CSV must include a header and at least one data row");
  }
  const parsed = parseCsv(csvText);
  if (parsed.length < 2) {
    throw new BadRequestException("CSV must include a header and at least one data row");
  }
  return parsed;
}

function isTerminated(statusRaw: string): boolean {
  return foldHeader(statusRaw) === "terminated";
}

function isImportReadyNo(raw: string): boolean {
  const f = foldHeader(raw);
  return f === "no" || f === "false" || f === "0";
}

function isImportReadyYes(raw: string): boolean {
  const f = foldHeader(raw);
  return !raw.trim() || f === "yes" || f === "true" || f === "1";
}

function num(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function actorUuid(id: string): string | undefined {
  return UUID_RE.test(id) ? id : undefined;
}

type EmploymentHit = {
  id: string;
  hireDate: Date;
  financeEmployeeId: string | null;
};

@Injectable()
export class WorkforceMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: MdmService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly provision: WorkforceProvisionService,
    private readonly roster: WorkforceRosterService,
    private readonly finance: FinanceWorkforceMirrorClient,
    private readonly importService: WorkforceImportService,
    private readonly audit: WorkforceAuditService,
    @Optional() private readonly rosterCache?: WorkforceRosterCache,
  ) {}

  async status(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    await this.scope.resolveScopeForCommercialOrg(organizationId);
    const rows = await this.prisma.workforceMigrationStep.findMany({
      where: { organizationId },
    });
    const byId = new Map(rows.map((r) => [r.stepId, r]));
    const steps = MIGRATION_STEPS.map((def) => {
      const row = byId.get(def.id);
      const status =
        row?.status === "applied" || row?.status === "skipped"
          ? row.status
          : "open";
      return {
        id: def.id,
        required: def.required,
        skippable: def.skippable,
        needsFile: def.needsFile,
        writes: def.writes,
        status,
        summary: row?.summaryJson ?? null,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    });
    let priorStepWarning: { stepId: string; message: string } | null = null;
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      if (prev.status === "open") {
        priorStepWarning = {
          stepId: prev.id,
          message: `Previous step ${prev.id} is still open`,
        };
        break;
      }
    }
    return { steps, priorStepWarning, fields: MIGRATION_FIELDS };
  }

  async preview(
    organizationId: string,
    actorUserId: string,
    stepIdRaw: string,
    csvText: string,
  ) {
    return this.run(organizationId, actorUserId, stepIdRaw, csvText, true);
  }

  async apply(
    organizationId: string,
    actorUserId: string,
    stepIdRaw: string,
    csvText: string,
  ) {
    const result = await this.run(
      organizationId,
      actorUserId,
      stepIdRaw,
      csvText,
      false,
    );
    const stepId = this.parseStep(stepIdRaw);
    const wrote = result.created + result.updated;
    if (!(result.errors > 0 && wrote === 0)) {
      await this.persistStep(organizationId, stepId, "applied", result);
    }
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    await this.audit.log({
      organizationId,
      workforceScopeId: link.workforceScopeId,
      actorUserId,
      action: "WORKFORCE_IMPORT_APPLIED",
      entityType: "WorkforceMigration",
      entityId: organizationId,
      payload: {
        kind: `migration:${stepId}`,
        stepId,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
      },
    });
    return result;
  }

  async skip(organizationId: string, actorUserId: string, stepIdRaw: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const stepId = this.parseStep(stepIdRaw);
    const def = MIGRATION_STEPS.find((s) => s.id === stepId)!;
    if (!def.skippable) {
      throw new BadRequestException("This step is required and cannot be skipped");
    }
    const summary = { outcome: "skipped" };
    await this.persistStep(organizationId, stepId, "skipped", summary);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    await this.audit.log({
      organizationId,
      workforceScopeId: link.workforceScopeId,
      actorUserId,
      action: "WORKFORCE_IMPORT_APPLIED",
      entityType: "WorkforceMigration",
      entityId: organizationId,
      payload: {
        kind: `migration:${stepId}`,
        stepId,
        outcome: "skipped",
      },
    });
    return { stepId, status: "skipped" as const };
  }

  private parseStep(stepIdRaw: string): MigrationStepId {
    if (!isMigrationStepId(stepIdRaw)) {
      throw new BadRequestException(`Unknown migration step: ${stepIdRaw}`);
    }
    return stepIdRaw;
  }

  private async persistStep(
    organizationId: string,
    stepId: MigrationStepId,
    status: "applied" | "skipped",
    summary: unknown,
  ) {
    await this.prisma.workforceMigrationStep.upsert({
      where: {
        organizationId_stepId: { organizationId, stepId },
      },
      create: {
        organizationId,
        stepId,
        status,
        summaryJson: summary as object,
      },
      update: {
        status,
        summaryJson: summary as object,
      },
    });
  }

  private async run(
    organizationId: string,
    actorUserId: string,
    stepIdRaw: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const stepId = this.parseStep(stepIdRaw);
    const def = MIGRATION_STEPS.find((s) => s.id === stepId)!;
    if (!def.writes) {
      throw new BadRequestException("This step has no write; skip it");
    }
    switch (stepId) {
      case "org-structure":
        return this.runOrgStructure(organizationId, actorUserId, csvText, dryRun);
      case "places":
        return this.runPlaces(organizationId, actorUserId, csvText, dryRun);
      case "people":
        return this.runPeople(organizationId, actorUserId, csvText, dryRun);
      case "brigades":
        return this.runBrigades(organizationId, actorUserId, csvText, dryRun);
      case "assignments":
        return this.runAssignments(organizationId, actorUserId, csvText, dryRun);
      case "vacation-balance":
        return this.runVacationBalance(organizationId, csvText, dryRun);
      case "leave-history":
        return this.runLeaveHistory(organizationId, actorUserId, csvText, dryRun);
      case "salary":
        return this.runSalary(organizationId, csvText, dryRun);
      default:
        throw new BadRequestException("This step has no write; skip it");
    }
  }

  private async runOrgStructure(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const imported = await this.importService.importOrgStructure(
      organizationId,
      actorUserId,
      csvText,
      dryRun,
      { skipAudit: true },
    );
    return {
      dryRun: imported.dryRun,
      created: imported.created,
      updated: 0,
      skipped: imported.skipped,
      errors: imported.errors,
      rows: imported.rows.slice(0, MIGRATION_DETAIL_LIMIT).map((r) => ({
        index: r.index,
        status: r.status === "error" ? "error" : r.status === "created" ? "created" : "skipped",
        message: r.message,
      })),
    };
  }

  private async runPlaces(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iPlace = headerIndex(headers, "place");
    const iReady = headerIndex(headers, "importReady", "importready");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if (iPlace < 0) {
      throw new BadRequestException("CSV header must include place");
    }
    const existing = await this.prisma.workforcePlace.findMany({
      where: { organizationId },
    });
    const seen = new Set<string>();
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      if (iReady >= 0 && isImportReadyNo(col(cols, iReady))) {
        push(acc, index, "skipped", "importReady=no");
        continue;
      }
      if (iReady >= 0 && !isImportReadyYes(col(cols, iReady))) {
        push(acc, index, "skipped", "importReady not yes");
        continue;
      }
      const placeName = col(cols, iPlace);
      if (!placeName) {
        push(acc, index, "skipped", "Empty place");
        continue;
      }
      const code = placeCodeFromName(placeName);
      if (seen.has(code)) {
        continue;
      }
      seen.add(code);
      const found = existing.find(
        (p) =>
          p.code.toUpperCase() === code ||
          foldHeader(p.name) === foldHeader(placeName),
      );
      if (found) {
        push(acc, index, "skipped", `Place already exists: ${found.name}`);
        continue;
      }
      if (dryRun) {
        push(acc, index, "created", `OK (dry-run): place ${placeName}`);
        continue;
      }
      const row = await this.roster.createPlace(organizationId, actorUserId, {
        code,
        name: placeName,
      });
      existing.push(row);
      push(acc, index, "created", `Place created: ${placeName}`);
    }
    return finish(acc, dryRun);
  }

  private async runPeople(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iPerson = headerIndex(headers, "globalPersonId", "globalpersonid");
    const iFirst = headerIndex(headers, "firstName", "firstname", "ad");
    const iMiddle = headerIndex(headers, "middleName", "middlename", "patronymic");
    const iLast = headerIndex(headers, "lastName", "lastname", "soyad");
    const iName = headerIndex(headers, "fullName", "fullname");
    const iUnit = headerIndex(headers, "orgUnit", "orgunit", "unit");
    const iPos = headerIndex(headers, "position");
    const iHire = headerIndex(headers, "hireDate", "hiredate");
    const iBirth = headerIndex(headers, "birthDate", "birthdate");
    const iSex = headerIndex(headers, "sex", "gender");
    const iReady = headerIndex(headers, "importReady", "importready");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if ((iFin < 0 && iPerson < 0) || iUnit < 0 || iPos < 0 || iHire < 0) {
      throw new BadRequestException(
        "CSV header must include (fin or globalPersonId), orgUnit, position, hireDate",
      );
    }
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const units = await this.prisma.orgUnit.findMany({
      where: { workforceScopeId: link.workforceScopeId, status: "ACTIVE" },
    });
    const positions = await this.prisma.workforcePosition.findMany({
      where: { orgUnit: { workforceScopeId: link.workforceScopeId } },
    });
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      if (iReady >= 0 && isImportReadyNo(col(cols, iReady))) {
        push(acc, index, "skipped", "importReady=no");
        continue;
      }
      const fin = col(cols, iFin).toUpperCase();
      const globalPersonId = col(cols, iPerson);
      if (fin && fin.length === 5) {
        push(acc, index, "error", "FIN is 5 characters — review queue");
        continue;
      }
      if (fin && fin.length !== 7) {
        push(acc, index, "error", `FIN must be 7 characters (got ${fin.length})`);
        continue;
      }
      if (!fin && !globalPersonId) {
        push(acc, index, "error", "Missing fin");
        continue;
      }
      const firstName = col(cols, iFirst);
      const middleName = col(cols, iMiddle);
      const lastName = col(cols, iLast);
      const fullName = col(cols, iName);
      const hasParts = Boolean(firstName && lastName);
      const orgUnitName = col(cols, iUnit);
      const positionName = col(cols, iPos);
      const hireRaw = col(cols, iHire);
      const hireDate = normalizeDateOnly(hireRaw);
      const birthDate = normalizeDateOnly(col(cols, iBirth));
      const sex = col(cols, iSex);
      const label =
        [firstName, middleName, lastName].filter(Boolean).join(" ") ||
        fullName ||
        fin ||
        `row ${index}`;
      if (fin && !hasParts && !fullName) {
        push(acc, index, "error", "firstName+lastName or fullName is required when hiring by fin");
        continue;
      }
      if (!orgUnitName || !positionName || !hireDate) {
        push(
          acc,
          index,
          "error",
          hireRaw && !hireDate
            ? `Invalid hireDate (YYYY-MM-DD): ${hireRaw}`
            : "Missing orgUnit, position, hireDate",
        );
        continue;
      }
      const unit = units.find(
        (u) =>
          u.name.toLowerCase() === orgUnitName.toLowerCase() ||
          (u.code != null && u.code.toLowerCase() === orgUnitName.toLowerCase()),
      );
      if (!unit) {
        push(acc, index, "error", `Org unit not found: ${orgUnitName}`);
        continue;
      }
      const position = positions.find(
        (p) =>
          p.orgUnitId === unit.id &&
          p.name.toLowerCase() === positionName.toLowerCase(),
      );
      if (!position) {
        push(acc, index, "error", `Position not found in unit: ${positionName}`);
        continue;
      }
      if (dryRun) {
        push(acc, index, "created", `OK (dry-run): ${label} → ${unit.name}/${position.name}`);
        continue;
      }
      let personId = globalPersonId;
      if (hasParts || fullName) {
        try {
          const resolved = await this.mdm.workforceResolvePerson({
            organizationId,
            ...(globalPersonId ? { globalPersonId } : {}),
            fin,
            ...(hasParts
              ? { firstName, middleName: middleName || undefined, lastName }
              : { fullName }),
            ...(birthDate ? { birthDate } : {}),
            ...(sex ? { sex } : {}),
          });
          personId = resolved.globalPersonId;
        } catch (err) {
          push(
            acc,
            index,
            "error",
            err instanceof Error ? err.message : "MDM resolve failed",
          );
          continue;
        }
      }
      if (!personId) {
        push(acc, index, "error", "Could not resolve person");
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
              ? isoDayUtc(existing.hireDate)
              : String(existing.hireDate ?? "").slice(0, 10);
          if (hireDate && prevHire !== hireDate) {
            await this.prisma.workforceEmployment.update({
              where: { id: existing.id },
              data: { hireDate: new Date(`${hireDate}T00:00:00.000Z`) },
            });
            await this.rosterCache?.forgetOrganization(organizationId);
          }
          push(
            acc,
            index,
            "skipped",
            `Active employment already exists (${prevHire} → ${hireDate})`,
          );
          continue;
        }
        await this.provision.hire(organizationId, actorUserId, {
          globalPersonId: personId,
          hireDate,
          orgUnitId: unit.id,
          positionId: position.id,
          satelliteKeys: [],
        });
        push(acc, index, "created", `Hired ${label} (headcount, no seat)`);
      } catch (err) {
        push(acc, index, "error", err instanceof Error ? err.message : "Hire failed");
      }
    }
    return finish(acc, dryRun);
  }

  private async runBrigades(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iBrigade = headerIndex(headers, "brigade");
    const iHire = headerIndex(headers, "hireDate", "hiredate");
    const iReady = headerIndex(headers, "importReady", "importready");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if (iFin < 0 || iBrigade < 0) {
      throw new BadRequestException("CSV header must include fin and brigade");
    }
    const brigades = await this.prisma.workforceBrigade.findMany({
      where: { organizationId },
    });
    const lookup = this.employmentLookup(organizationId);
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      if (iReady >= 0 && isImportReadyNo(col(cols, iReady))) {
        push(acc, index, "skipped", "importReady=no");
        continue;
      }
      const brigadeName = col(cols, iBrigade);
      if (!brigadeName) {
        push(acc, index, "skipped", "Empty brigade");
        continue;
      }
      const fin = col(cols, iFin).toUpperCase();
      const hireDate = normalizeDateOnly(col(cols, iHire)) || undefined;
      const emp = await lookup(fin);
      if (!emp) {
        push(acc, index, "error", `Employment not found for FIN ${fin || "(empty)"}`);
        continue;
      }
      const code = brigadeCodeFromName(brigadeName);
      let brigade = brigades.find((b) => b.code.toUpperCase() === code);
      if (dryRun) {
        push(
          acc,
          index,
          "created",
          brigade
            ? `OK (dry-run): join ${code}`
            : `OK (dry-run): create ${code} and join`,
        );
        continue;
      }
      try {
        if (!brigade) {
          const created = await this.roster.createBrigade(organizationId, actorUserId, {
            code,
            name: brigadeName.trim(),
            employmentIds: [],
            effectiveFrom: hireDate,
          });
          brigade = { id: created.id, code: created.code, name: created.name } as (typeof brigades)[0];
          brigades.push(brigade);
        }
        const moved = await this.roster.transferBrigadeMembers(
          organizationId,
          actorUserId,
          {
            employmentIds: [emp.id],
            toBrigadeId: brigade.id,
            effectiveFrom: hireDate ?? isoDayUtc(emp.hireDate),
          },
        );
        if (moved.skippedCount > 0 && moved.movedCount === 0) {
          push(acc, index, "skipped", `Already in brigade ${code}`);
        } else {
          push(acc, index, "created", `Joined brigade ${code} from ${hireDate ?? "hire date"}`);
        }
      } catch (err) {
        push(
          acc,
          index,
          "error",
          err instanceof Error ? err.message : "Brigade join failed",
        );
      }
    }
    return finish(acc, dryRun);
  }

  private async runAssignments(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iPlace = headerIndex(headers, "place");
    const iShift = headerIndex(headers, "shiftName", "shiftname");
    const iSched = headerIndex(headers, "scheduleText", "scheduletext", "schedule");
    const iHire = headerIndex(headers, "hireDate", "hiredate");
    const iReady = headerIndex(headers, "importReady", "importready");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if (iFin < 0) {
      throw new BadRequestException("CSV header must include fin");
    }
    const places = await this.prisma.workforcePlace.findMany({
      where: { organizationId },
    });
    const cycles = await this.prisma.workforceShiftCycle.findMany({
      where: { organizationId },
    });
    const lookup = this.employmentLookup(organizationId);
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      if (iReady >= 0 && isImportReadyNo(col(cols, iReady))) {
        push(acc, index, "skipped", "importReady=no");
        continue;
      }
      const fin = col(cols, iFin).toUpperCase();
      const placeName = col(cols, iPlace);
      const cycleRaw = col(cols, iShift) || col(cols, iSched);
      const emp = await lookup(fin);
      if (!emp) {
        push(acc, index, "error", `Employment not found for FIN ${fin || "(empty)"}`);
        continue;
      }
      if (!placeName) {
        push(acc, index, "error", "Missing place");
        continue;
      }
      const place = places.find(
        (p) =>
          foldHeader(p.name) === foldHeader(placeName) ||
          foldHeader(p.code) === foldHeader(placeName) ||
          p.code.toUpperCase() === placeCodeFromName(placeName),
      );
      if (!place) {
        push(acc, index, "error", `Place not found: ${placeName}`);
        continue;
      }
      if (!cycleRaw) {
        push(acc, index, "error", "Missing shiftName / scheduleText");
        continue;
      }
      const cycle = cycles.find(
        (c) =>
          foldHeader(c.code) === foldHeader(cycleRaw) ||
          foldHeader(c.name) === foldHeader(cycleRaw),
      );
      if (!cycle) {
        push(acc, index, "error", `Cycle not found for ${cycleRaw}`);
        continue;
      }
      const from = normalizeDateOnly(col(cols, iHire)) || isoDayUtc(emp.hireDate);
      const existing = await this.prisma.workforceShiftAssignment.findFirst({
        where: {
          organizationId,
          employmentId: emp.id,
          placeId: place.id,
          cycleId: cycle.id,
          effectiveTo: null,
        },
      });
      if (existing) {
        push(acc, index, "skipped", "Open assignment already exists");
        continue;
      }
      if (dryRun) {
        push(acc, index, "created", `OK (dry-run): ${place.name} / ${cycle.code}`);
        continue;
      }
      try {
        await this.roster.createAssignment(organizationId, actorUserId, {
          placeId: place.id,
          cycleId: cycle.id,
          employmentId: emp.id,
          effectiveFrom: from,
        });
        push(acc, index, "created", `Assigned ${place.name} / ${cycle.code}`);
      } catch (err) {
        push(
          acc,
          index,
          "error",
          err instanceof Error ? err.message : "Assignment failed",
        );
      }
    }
    return finish(acc, dryRun);
  }

  private async runVacationBalance(
    organizationId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iBal = headerIndex(headers, "balanceDays", "balancedays");
    const iAsOf = headerIndex(headers, "asOfDate", "asofdate");
    const iBase = headerIndex(headers, "baseVacationDaysPerYear", "basevacationdaysperyear");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if (iFin < 0 || iBal < 0 || iAsOf < 0) {
      throw new BadRequestException("CSV header must include fin, balanceDays, asOfDate");
    }
    const lookup = this.employmentLookup(organizationId);
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      const fin = col(cols, iFin).toUpperCase();
      const emp = await lookup(fin);
      if (!emp) {
        push(acc, index, "error", `Employment not found for FIN ${fin || "(empty)"}`);
        continue;
      }
      if (!emp.financeEmployeeId) {
        push(acc, index, "error", "mirror not ready");
        continue;
      }
      const balanceDays = num(col(cols, iBal));
      const asOfDate = normalizeDateOnly(col(cols, iAsOf));
      const base = num(col(cols, iBase));
      if (balanceDays == null || !asOfDate) {
        push(acc, index, "error", "Missing balanceDays or asOfDate");
        continue;
      }
      if (dryRun) {
        push(acc, index, "updated", `OK (dry-run): opening ${balanceDays} as of ${asOfDate}`);
        continue;
      }
      try {
        await this.finance.applyEmploymentOpening(organizationId, emp.id, {
          balanceDays,
          asOfDate,
          ...(base != null && base > 0 ? { baseVacationDaysPerYear: base } : {}),
        });
        push(acc, index, "updated", `Vacation opening ${balanceDays} as of ${asOfDate}`);
      } catch (err) {
        push(
          acc,
          index,
          "error",
          err instanceof Error ? err.message : "Finance opening failed",
        );
      }
    }
    return finish(acc, dryRun);
  }

  private async runLeaveHistory(
    organizationId: string,
    actorUserId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iKind = headerIndex(headers, "kind");
    const iStart = headerIndex(headers, "startDate", "startdate", "start");
    const iEnd = headerIndex(headers, "endDate", "enddate", "end");
    const iOrder = headerIndex(headers, "orderNo", "orderno", "orderNumber");
    const iOrderDate = headerIndex(headers, "orderDate", "orderdate");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if (iFin < 0 || iKind < 0 || iStart < 0 || iEnd < 0) {
      throw new BadRequestException("CSV header must include fin, kind, startDate, endDate");
    }
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const lookup = this.employmentLookup(organizationId);
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      const kindRaw = col(cols, iKind).toUpperCase();
      if (kindRaw === "COMPENSATION" || kindRaw === "OTHER") {
        push(acc, index, "skipped", `${kindRaw} is not an absence`);
        continue;
      }
      if (kindRaw !== "VACATION") {
        push(acc, index, "skipped", `Unsupported kind ${kindRaw || "(empty)"}`);
        continue;
      }
      const fin = col(cols, iFin).toUpperCase();
      const emp = await lookup(fin);
      if (!emp) {
        push(acc, index, "error", `Employment not found for FIN ${fin || "(empty)"}`);
        continue;
      }
      const startDate = normalizeDateOnly(col(cols, iStart));
      const endDate = normalizeDateOnly(col(cols, iEnd));
      if (!startDate || !endDate) {
        push(acc, index, "error", "Invalid startDate or endDate");
        continue;
      }
      if (startDate > endDate) {
        push(acc, index, "error", `startDate ${startDate} is after endDate ${endDate}`);
        continue;
      }
      const excelOrder = col(cols, iOrder);
      const orderDate = normalizeDateOnly(col(cols, iOrderDate));
      const sourceRef = `${fin}|${excelOrder || startDate}|${startDate}|${endDate}`;
      if (dryRun) {
        push(acc, index, "created", `OK (dry-run): VACATION ${startDate}–${endDate}`);
        continue;
      }
      try {
        const out = await this.upsertImportedLeave({
          organizationId,
          workforceScopeId: link.workforceScopeId,
          actorUserId,
          employmentId: emp.id,
          fin,
          excelOrder,
          orderDate,
          startDate,
          endDate,
          sourceRef,
        });
        push(
          acc,
          index,
          out.created ? "created" : "updated",
          `${out.created ? "Imported" : "Updated"} leave ${startDate}–${endDate}`,
        );
      } catch (err) {
        push(
          acc,
          index,
          "error",
          err instanceof Error ? err.message : "Leave import failed",
        );
      }
    }
    return finish(acc, dryRun);
  }

  async upsertImportedLeave(input: {
    organizationId: string;
    workforceScopeId: string;
    actorUserId: string;
    employmentId: string;
    fin: string;
    excelOrder: string;
    orderDate?: string;
    startDate: string;
    endDate: string;
    sourceRef: string;
  }): Promise<{ absenceId: string; orderId: string; created: boolean }> {
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    const actorId = actorUuid(input.actorUserId);
    const note = [
      input.excelOrder ? `Order ${input.excelOrder}` : "Imported leave",
      input.orderDate ? input.orderDate : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const existingAbs = await this.prisma.workforceAbsence.findFirst({
      where: {
        organizationId: input.organizationId,
        source: MIGRATION_SOURCE,
        sourceRef: input.sourceRef,
      },
    });
    let absenceId: string;
    let created = false;
    if (existingAbs) {
      await this.prisma.workforceAbsence.update({
        where: { id: existingAbs.id },
        data: {
          startDate: start,
          endDate: end,
          note,
          status: WorkforceAbsenceStatus.APPROVED,
          kind: WorkforceAbsenceKind.VACATION,
        },
      });
      absenceId = existingAbs.id;
    } else {
      const row = await this.prisma.workforceAbsence.create({
        data: {
          organizationId: input.organizationId,
          employmentId: input.employmentId,
          kind: WorkforceAbsenceKind.VACATION,
          startDate: start,
          endDate: end,
          note,
          status: WorkforceAbsenceStatus.APPROVED,
          approvedAt: new Date(),
          approvedByUserId: actorId,
          source: MIGRATION_SOURCE,
          sourceRef: input.sourceRef,
        },
      });
      absenceId = row.id;
      created = true;
    }

    const existingOrd = await this.prisma.workforcePersonnelOrder.findFirst({
      where: {
        organizationId: input.organizationId,
        source: MIGRATION_SOURCE,
        sourceRef: input.sourceRef,
      },
    });
    let orderNumber = input.excelOrder.trim() || `IMP-${input.fin}-${input.startDate}`;
    const contextJson = {
      imported: true,
      excelOrderNo: input.excelOrder || orderNumber,
      orderDate: input.orderDate || null,
      leave: { startDate: input.startDate, endDate: input.endDate },
    };
    if (!existingOrd) {
      const clash = await this.prisma.workforcePersonnelOrder.findFirst({
        where: {
          workforceScopeId: input.workforceScopeId,
          orderNumber,
        },
      });
      if (clash && clash.employmentId === input.employmentId) {
        await this.prisma.workforcePersonnelOrder.update({
          where: { id: clash.id },
          data: {
            effectiveDate: start,
            status: WorkforcePersonnelOrderStatus.ISSUED,
            source: MIGRATION_SOURCE,
            sourceRef: input.sourceRef,
            note,
            contextJson,
          },
        });
        return { absenceId, orderId: clash.id, created };
      }
      if (clash && clash.employmentId !== input.employmentId) {
        orderNumber = `${orderNumber}-${input.fin}`;
      }
      const createdOrd = await this.prisma.workforcePersonnelOrder.create({
        data: {
          workforceScopeId: input.workforceScopeId,
          employmentId: input.employmentId,
          organizationId: input.organizationId,
          type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
          status: WorkforcePersonnelOrderStatus.ISSUED,
          orderNumber,
          sequenceYear: null,
          sequenceSeq: null,
          effectiveDate: start,
          note,
          issuedAt: new Date(),
          issuedByUserId: actorId,
          source: MIGRATION_SOURCE,
          sourceRef: input.sourceRef,
          contextJson,
        },
      });
      return { absenceId, orderId: createdOrd.id, created };
    }
    await this.prisma.workforcePersonnelOrder.update({
      where: { id: existingOrd.id },
      data: {
        effectiveDate: start,
        status: WorkforcePersonnelOrderStatus.ISSUED,
        note,
        contextJson,
      },
    });
    return { absenceId, orderId: existingOrd.id, created };
  }

  private async runSalary(
    organizationId: string,
    csvText: string,
    dryRun: boolean,
  ): Promise<MigrationResult> {
    const parsed = requireCsv(csvText);
    const headers = parsed[0];
    const iFin = headerIndex(headers, "fin");
    const iSalary = headerIndex(headers, "salary");
    const iRate = headerIndex(headers, "internalRate", "internalrate");
    const iStatus = headerIndex(headers, "employmentStatus", "employmentstatus");
    if (iFin < 0 || iSalary < 0) {
      throw new BadRequestException("CSV header must include fin and salary");
    }
    const lookup = this.employmentLookup(organizationId);
    const acc = emptyAcc();
    for (let r = 1; r < parsed.length; r++) {
      const index = r + 1;
      const cols = parsed[r];
      if (isTerminated(col(cols, iStatus))) {
        push(acc, index, "skipped", "Terminated row");
        continue;
      }
      const fin = col(cols, iFin).toUpperCase();
      const emp = await lookup(fin);
      if (!emp) {
        push(acc, index, "error", `Employment not found for FIN ${fin || "(empty)"}`);
        continue;
      }
      if (!emp.financeEmployeeId) {
        push(acc, index, "error", "mirror not ready");
        continue;
      }
      const salary = num(col(cols, iSalary));
      const internalRate = iRate >= 0 ? num(col(cols, iRate)) : null;
      if (salary == null) {
        push(acc, index, "error", "Missing salary");
        continue;
      }
      if (dryRun) {
        push(acc, index, "updated", `OK (dry-run): salary ${salary}`);
        continue;
      }
      try {
        await this.finance.applyEmploymentOpening(organizationId, emp.id, {
          salary,
          ...(internalRate != null ? { internalRate } : {}),
        });
        push(acc, index, "updated", `Salary ${salary}`);
      } catch (err) {
        push(
          acc,
          index,
          "error",
          err instanceof Error ? err.message : "Finance opening failed",
        );
      }
    }
    return finish(acc, dryRun);
  }

  private employmentLookup(organizationId: string) {
    const cache = new Map<string, EmploymentHit | null>();
    return async (fin: string): Promise<EmploymentHit | null> => {
      const key = fin.trim().toUpperCase();
      if (!key) return null;
      if (cache.has(key)) return cache.get(key) ?? null;
      const row = await this.findActiveEmploymentByFin(organizationId, key);
      cache.set(key, row);
      return row;
    };
  }

  private async findActiveEmploymentByFin(
    organizationId: string,
    fin: string,
  ): Promise<EmploymentHit | null> {
    if (!fin) return null;
    const personId = await this.mdm.findPersonIdByFin(fin);
    if (!personId) return null;
    return this.prisma.workforceEmployment.findFirst({
      where: {
        organizationId,
        globalPersonId: personId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      select: { id: true, hireDate: true, financeEmployeeId: true },
    });
  }
}
