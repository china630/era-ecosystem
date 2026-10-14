import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { WorkforceEmploymentStatus } from "@era365/database";
import { todayBakuYmd } from "@era/satellite-kit/time";
import * as XLSX from "xlsx";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FinanceWorkforceMirrorClient } from "./finance-workforce-mirror.client";
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
    @Optional() private readonly finance?: FinanceWorkforceMirrorClient,
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
      "staffCode,globalPersonId,firstName,middleName,lastName,displayName,orgUnit,position,hireDate,status";
    const lines = rows.map((r) => {
      const profile = profiles[r.globalPersonId];
      const displayName =
        (typeof profile?.displayName === "string" && profile.displayName.trim()) ||
        r.globalPersonId.slice(0, 8);
      return [
        staffCodeFromEmployment(r.id),
        r.globalPersonId,
        profile?.firstName ?? "",
        profile?.middleName ?? "",
        profile?.lastName ?? "",
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

  /** Contract salary and the last posted payslip. Empty when Finance has no row. */
  async paySnapshot(organizationId: string, employmentId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId },
      select: { id: true, financeEmployeeId: true },
    });
    if (!employment) throw new NotFoundException("Employment not found");
    const mirror = this.finance
      ? await this.finance.fetchEmploymentMirror(organizationId, employmentId)
      : { salary: null, vacationDaysBalance: null, employmentStatus: null };
    const payslip = await this.latestPayslip(
      organizationId,
      employment.financeEmployeeId,
    );
    return {
      gross: mirror.salary,
      net: payslip?.net ?? null,
      netYear: payslip?.year ?? null,
      netMonth: payslip?.month ?? null,
      vacationDaysBalance: mirror.vacationDaysBalance,
    };
  }

  /**
   * One-way cadre file. Full FIN and ID series/number are logged
   * (WORKFORCE_HR_FIN_LIST and WORKFORCE_HR_ID_EXPORT).
   */
  async exportCadreXlsx(organizationId: string): Promise<Buffer> {
    await this.entitlement.assertWorkforceHub(organizationId);
    const rows = await this.prisma.workforceEmployment.findMany({
      where: { organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      include: { orgUnit: true, position: true },
      orderBy: { hireDate: "asc" },
    });
    const personIds = [...new Set(rows.map((row) => row.globalPersonId))];
    const [profiles, fins, cards] = await Promise.all([
      this.mdm.batchGetPersonOpsProfile(personIds, organizationId),
      this.mdm.batchHrListFin(personIds, organizationId),
      this.mdm.batchHrExportIdCards(personIds, organizationId),
    ]);
    const sheetRows = [];
    for (const row of rows) {
      const profile = profiles[row.globalPersonId];
      const saa = [profile?.lastName, profile?.firstName, profile?.middleName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const pay = await this.paySnapshot(organizationId, row.id);
      sheetRows.push({
        SAA: saa,
        birthDate: profile?.birthDate ?? "",
        FIN: fins[row.globalPersonId] ?? "",
        idSeries: cards[row.globalPersonId]?.series ?? "",
        idNumber: cards[row.globalPersonId]?.number ?? "",
        position: row.position?.name ?? "",
        department: row.orgUnit?.name ?? "",
        hireDate: row.hireDate.toISOString().slice(0, 10),
        contractEnd: row.contractEndDate
          ? row.contractEndDate.toISOString().slice(0, 10)
          : "",
        gross: pay.gross ?? "",
        net: pay.net ?? "",
      });
    }
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      sheetRows.length
        ? sheetRows
        : [
            {
              SAA: "",
              birthDate: "",
              FIN: "",
              idSeries: "",
              idNumber: "",
              position: "",
              department: "",
              hireDate: "",
              contractEnd: "",
              gross: "",
              net: "",
            },
          ],
    );
    XLSX.utils.book_append_sheet(book, sheet, "cadre");
    return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  private async latestPayslip(
    organizationId: string,
    financeEmployeeId: string | null,
  ) {
    if (!this.finance || !financeEmployeeId) return null;
    const [year0, month0] = todayBakuYmd().split("-").map(Number);
    let year = year0;
    let month = month0;
    for (let i = 0; i < 6; i += 1) {
      const slip = await this.finance.fetchPostedPayslip({
        organizationId,
        financeEmployeeId,
        year,
        month,
      });
      if (slip?.net != null && slip.net !== "") return slip;
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
    }
    return null;
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
      "staffCode,globalPersonId,displayName,workDate,hours,normalMinutes,shortfallMinutes,overtimeMinutes,nightMinutes,restDayMinutes,holidayMinutes,hourlyLeaveMinutes,breakMinutes,orgUnit,position,source";
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
        e.normalMinutes ?? "",
        e.shortfallMinutes ?? "",
        e.overtimeMinutes ?? "",
        e.nightMinutes ?? "",
        e.restDayMinutes ?? "",
        e.holidayMinutes ?? "",
        e.hourlyLeaveMinutes ?? "",
        e.breakMinutes ?? "",
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
