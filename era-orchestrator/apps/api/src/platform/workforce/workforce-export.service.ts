import { Injectable } from "@nestjs/common";
import { WorkforceEmploymentStatus } from "@era365/database";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function staffCodeFromEmployment(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

@Injectable()
export class WorkforceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: MdmService,
    private readonly entitlement: WorkforceEntitlementService,
  ) {}

  async exportRosterCsv(organizationId: string): Promise<string> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const rows = await this.prisma.workforceEmployment.findMany({
      where: { organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      include: { orgUnit: true, position: true },
      orderBy: { hireDate: "asc" },
    });
    const personIds = [...new Set(rows.map((r) => r.globalPersonId))];
    const profiles = await this.mdm.batchGetPersonOpsProfile(personIds, organizationId);

    const header =
      "staffCode,globalPersonId,displayName,orgUnit,position,hireDate,status";
    const lines = rows.map((r) => {
      const profile = profiles[r.globalPersonId];
      const displayName =
        (typeof profile?.displayName === "string" && profile.displayName.trim()) ||
        r.globalPersonId.slice(0, 8);
      return [
        staffCodeFromEmployment(r.id),
        r.globalPersonId,
        displayName,
        r.orgUnit?.name ?? "",
        r.position?.name ?? "",
        r.hireDate.toISOString().slice(0, 10),
        r.status,
      ]
        .map((c) => csvEscape(String(c)))
        .join(",");
    });
    return [header, ...lines].join("\n");
  }

  async exportAbsencesCsv(
    organizationId: string,
    from: string,
    to: string,
  ): Promise<string> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const fromDate = new Date(`${from.slice(0, 10)}T00:00:00.000Z`);
    const toDate = new Date(`${to.slice(0, 10)}T00:00:00.000Z`);
    const absences = await this.prisma.workforceAbsence.findMany({
      where: {
        organizationId,
        status: "APPROVED",
        startDate: { lte: toDate },
        endDate: { gte: fromDate },
      },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
      orderBy: { startDate: "asc" },
    });
    const personIds = [
      ...new Set(absences.map((a) => a.employment.globalPersonId)),
    ];
    const profiles = await this.mdm.batchGetPersonOpsProfile(personIds, organizationId);

    const header =
      "staffCode,globalPersonId,displayName,kind,startDate,endDate,orgUnit,position";
    const lines = absences.map((a) => {
      const emp = a.employment;
      const profile = profiles[emp.globalPersonId];
      const displayName =
        (typeof profile?.displayName === "string" && profile.displayName.trim()) ||
        emp.globalPersonId.slice(0, 8);
      return [
        staffCodeFromEmployment(emp.id),
        emp.globalPersonId,
        displayName,
        a.kind,
        a.startDate.toISOString().slice(0, 10),
        a.endDate.toISOString().slice(0, 10),
        emp.orgUnit?.name ?? "",
        emp.position?.name ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",");
    });
    return [header, ...lines].join("\n");
  }

  async exportTimesheetCsv(
    organizationId: string,
    year: number,
    month: number,
  ): Promise<string> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    const entries = await this.prisma.workforceTimesheetEntry.findMany({
      where: {
        organizationId,
        status: "APPROVED",
        workDate: { gte: start, lte: end },
      },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
      orderBy: [{ workDate: "asc" }, { employmentId: "asc" }],
    });
    const personIds = [
      ...new Set(entries.map((e) => e.employment.globalPersonId)),
    ];
    const profiles = await this.mdm.batchGetPersonOpsProfile(personIds, organizationId);

    const header =
      "staffCode,globalPersonId,displayName,workDate,hours,orgUnit,position,source";
    const lines = entries.map((e) => {
      const emp = e.employment;
      const profile = profiles[emp.globalPersonId];
      const displayName =
        (typeof profile?.displayName === "string" && profile.displayName.trim()) ||
        emp.globalPersonId.slice(0, 8);
      return [
        staffCodeFromEmployment(emp.id),
        emp.globalPersonId,
        displayName,
        e.workDate.toISOString().slice(0, 10),
        String(e.hours),
        emp.orgUnit?.name ?? "",
        emp.position?.name ?? "",
        e.source,
      ]
        .map((c) => csvEscape(String(c)))
        .join(",");
    });
    return [header, ...lines].join("\n");
  }
}
