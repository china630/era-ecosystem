import { Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import {
  batchComplianceFinMap,
  batchEmployeePersonMap,
} from "./employee-person.util";
import { decryptText } from "../security/pii-crypto.util";

@Injectable()
export class PayrollExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: OrchestratorMdmClientService,
  ) {}

  async buildRunXlsxBuffer(
    organizationId: string,
    runId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: {
        slips: { include: { employee: true } },
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found");

    const personIds = run.slips.map((s) => s.employee.globalPersonId);
    const [personMap, finMap] = await Promise.all([
      batchEmployeePersonMap(this.mdm, organizationId, personIds),
      batchComplianceFinMap(this.mdm, organizationId, personIds),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "ERA Finance";
    wb.created = new Date();

    const sheet = wb.addWorksheet("Payroll", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "VÖEN", key: "voen", width: 14 },
      { header: "FIN", key: "fin", width: 12 },
      { header: "FIN note", key: "finNote", width: 24 },
      { header: "FİO", key: "fio", width: 30 },
      { header: "Kind", key: "kind", width: 12 },
      { header: "Gross", key: "gross", width: 14 },
      { header: "Income tax", key: "pit", width: 14 },
      { header: "DSMF (W)", key: "dW", width: 14 },
      { header: "DSMF (E)", key: "dE", width: 14 },
      { header: "İTS (W)", key: "iW", width: 14 },
      { header: "İTS (E)", key: "iE", width: 14 },
      { header: "İşsizlik (W)", key: "uW", width: 14 },
      { header: "İşsizlik (E)", key: "uE", width: 14 },
      { header: "Contr soc", key: "cSoc", width: 14 },
      { header: "Net", key: "net", width: 14 },
    ];

    for (const s of run.slips) {
      const p = personMap.get(s.employee.globalPersonId);
      const finSnap = finMap.get(s.employee.globalPersonId);
      const fio = `${p?.lastName ?? "—"} ${p?.firstName ?? "—"}`.trim();
      sheet.addRow({
        voen: s.employee.voenCipher ? (decryptText(s.employee.voenCipher) ?? "") : "",
        fin: finSnap?.fin ?? "",
        finNote: finSnap?.note ?? "",
        fio,
        kind: s.employee.kind,
        gross: Number(s.gross),
        pit: Number(s.incomeTax),
        dW: Number(s.dsmfWorker),
        dE: Number(s.dsmfEmployer),
        iW: Number(s.itsWorker),
        iE: Number(s.itsEmployer),
        uW: Number(s.unemploymentWorker),
        uE: Number(s.unemploymentEmployer),
        cSoc: Number(s.contractorSocialWithheld),
        net: Number(s.net),
      });
    }

    for (const c of sheet.columns) {
      c.numFmt =
        c.key &&
        !["voen", "fio", "fin", "finNote", "kind"].includes(String(c.key))
          ? "0.00"
          : undefined;
    }

    const raw = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
    const filename = `payroll-${run.year}-${String(run.month).padStart(2, "0")}.xlsx`;
    return { buffer, filename };
  }
}
