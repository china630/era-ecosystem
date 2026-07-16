import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import {
  EmployeeEmploymentStatus,
  EmployeeKind,
  PayrollRunStatus,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  OrchestratorMdmClientService,
  type MdmHrProfile,
} from "../orchestrator/orchestrator-mdm-client.service";
import { batchEmployeePersonMap } from "./employee-person.util";

export type ActiveListRow = {
  employeeId: string;
  globalPersonId: string;
  displayName: string | null;
  finMasked: string | null;
  departmentName: string | null;
  positionName: string | null;
  hireDate: string;
  tariffSalary: number;
  supplementSalary: number;
  salary: number;
  vacationDaysBalance: number;
  latestGross: number | null;
  latestNet: number | null;
  latestPayrollPeriod: string | null;
  hrProfile: MdmHrProfile | null;
};

@Injectable()
export class ActiveListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: OrchestratorMdmClientService,
  ) {}

  async buildActiveList(organizationId: string): Promise<ActiveListRow[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
        kind: EmployeeKind.EMPLOYEE,
        employmentStatus: EmployeeEmploymentStatus.ACTIVE,
      },
      include: {
        jobPosition: { include: { department: true } },
      },
      orderBy: { hireDate: "asc" },
    });

    if (employees.length === 0) return [];

    const personIds = employees.map((e) => e.globalPersonId);
    const [personMap, hrBatch, slips] = await Promise.all([
      batchEmployeePersonMap(this.mdm, organizationId, personIds),
      this.mdm.batchHrProfiles(personIds, organizationId),
      this.prisma.payrollSlip.findMany({
        where: {
          organizationId,
          deletedAt: null,
          employeeId: { in: employees.map((e) => e.id) },
          payrollRun: { status: PayrollRunStatus.POSTED },
        },
        include: { payrollRun: { select: { year: true, month: true } } },
        orderBy: [
          { payrollRun: { year: "desc" } },
          { payrollRun: { month: "desc" } },
          { createdAt: "desc" },
        ],
      }),
    ]);

    const latestByEmployee = new Map<
      string,
      {
        gross: number;
        net: number;
        period: string;
      }
    >();
    for (const slip of slips) {
      if (latestByEmployee.has(slip.employeeId)) continue;
      latestByEmployee.set(slip.employeeId, {
        gross: Number(slip.gross),
        net: Number(slip.net),
        period: `${slip.payrollRun.year}-${String(slip.payrollRun.month).padStart(2, "0")}`,
      });
    }

    return employees.map((e) => {
      const person = personMap.get(e.globalPersonId);
      const latest = latestByEmployee.get(e.id);
      const joined = [person?.lastName, person?.firstName]
        .filter((p) => p && p !== "—")
        .join(" ")
        .trim();
      const displayName =
        (person?.displayName && person.displayName !== "—"
          ? person.displayName
          : joined) || null;
      return {
        employeeId: e.id,
        globalPersonId: e.globalPersonId,
        displayName,
        finMasked: person?.finMasked ?? null,
        departmentName: e.jobPosition.department?.name ?? null,
        positionName: e.jobPosition.name ?? null,
        hireDate: e.hireDate.toISOString().slice(0, 10),
        tariffSalary: Number(e.tariffSalary),
        supplementSalary: Number(e.supplementSalary),
        salary: Number(e.salary),
        vacationDaysBalance: Number(e.vacationDaysBalance),
        latestGross: latest?.gross ?? null,
        latestNet: latest?.net ?? null,
        latestPayrollPeriod: latest?.period ?? null,
        hrProfile: hrBatch[e.globalPersonId] ?? null,
      };
    });
  }

  async buildActiveListXlsx(
    organizationId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.buildActiveList(organizationId);
    const wb = new ExcelJS.Workbook();
    wb.creator = "ERA Finance";
    wb.created = new Date();

    const sheet = wb.addWorksheet("Active list", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "FİO", key: "fio", width: 28 },
      { header: "FIN (masked)", key: "fin", width: 14 },
      { header: "Department", key: "dept", width: 22 },
      { header: "Position", key: "pos", width: 22 },
      { header: "Hire date", key: "hire", width: 12 },
      { header: "Tariff", key: "tariff", width: 12 },
      { header: "Supplement", key: "supp", width: 12 },
      { header: "Gross salary", key: "salary", width: 12 },
      { header: "Vacation balance", key: "vac", width: 14 },
      { header: "Last gross", key: "lgross", width: 12 },
      { header: "Last net", key: "lnet", width: 12 },
      { header: "Last period", key: "period", width: 12 },
      { header: "Blood group", key: "blood", width: 12 },
      { header: "Marital status", key: "marital", width: 14 },
      { header: "Education", key: "edu", width: 18 },
      { header: "Specialty", key: "spec", width: 18 },
      { header: "Statistical categories", key: "stats", width: 22 },
      { header: "Registration address", key: "reg", width: 28 },
      { header: "Actual address", key: "act", width: 28 },
    ];

    for (const r of rows) {
      const hr = r.hrProfile;
      const reg = hr?.addresses?.find((a) => a.kind === "REGISTRATION");
      const act = hr?.addresses?.find((a) => a.kind === "ACTUAL");
      sheet.addRow({
        fio: r.displayName ?? "—",
        fin: r.finMasked ?? "",
        dept: r.departmentName ?? "",
        pos: r.positionName ?? "",
        hire: r.hireDate,
        tariff: r.tariffSalary,
        supp: r.supplementSalary,
        salary: r.salary,
        vac: r.vacationDaysBalance,
        lgross: r.latestGross ?? "",
        lnet: r.latestNet ?? "",
        period: r.latestPayrollPeriod ?? "",
        blood: hr?.bloodGroup ?? "",
        marital: hr?.maritalStatus ?? "",
        edu: hr?.education ?? "",
        spec: hr?.specialty ?? "",
        stats: (hr?.statisticalCategories ?? []).join(", "),
        reg: formatAddress(reg),
        act: formatAddress(act),
      });
    }

    const raw = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
    const day = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `active-list-${day}.xlsx` };
  }
}

function formatAddress(
  a: { line: string | null; city: string | null; region: string | null } | undefined,
): string {
  if (!a) return "";
  return [a.line, a.city, a.region].filter(Boolean).join(", ");
}
