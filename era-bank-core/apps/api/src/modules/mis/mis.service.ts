import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

/**
 * MIS thin assemble/export (P2-3). Named report from GL/reg keys — not full BI.
 */
@Injectable()
export class MisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  async listAvailableReportKeys() {
    const templates = await this.prisma.regReportTemplate.findMany({
      select: { code: true, version: true, outputFormat: true },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
    const byCode = new Map<
      string,
      { code: string; version: string; outputFormat: string }
    >();
    for (const row of templates) {
      if (!byCode.has(row.code)) {
        byCode.set(row.code, {
          code: row.code,
          version: row.version,
          outputFormat: row.outputFormat,
        });
      }
    }
    return {
      scaffold: false,
      partial: true,
      source: "reg_report_templates",
      inventoryNote:
        "CAP-NFR-MIS PARTIAL thin export; not a data mart / BI suite.",
      reportKeys: [...byCode.values()],
      bankOrgId: this.bankOrg.bankOrgId,
    };
  }

  /**
   * Assemble a named MIS pack from ledger journal headers + reg template meta.
   * format=json (default) or csv (XLSX deferred — CSV is lab export).
   */
  async assembleReport(input: {
    reportCode: string;
    asOf?: Date;
    format?: "json" | "csv";
  }) {
    const code = input.reportCode?.trim();
    if (!code) throw new BadRequestException("reportCode required");
    const asOf = input.asOf ?? new Date();
    const template = await this.prisma.regReportTemplate.findFirst({
      where: { code },
      orderBy: { version: "desc" },
    });
    if (!template) {
      throw new BadRequestException(`Unknown report code: ${code}`);
    }

    const journals = await this.prisma.journalTransaction.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        createdAt: { lte: asOf },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        reference: true,
        valueDate: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    const glKeys = await this.prisma.systemGlConfig.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      select: { key: true, glCode: true },
      take: 200,
    });

    const rows = journals.map((j) => ({
      journalId: j.id,
      reference: j.reference,
      valueDate: j.valueDate.toISOString(),
      type: j.type,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    }));

    const pack = {
      methodology: "lab",
      notFullBi: true,
      reportCode: template.code,
      templateVersion: template.version,
      outputFormat: template.outputFormat,
      asOf: asOf.toISOString(),
      bankOrgId: this.bankOrg.bankOrgId,
      systemGlKeys: glKeys.map((g) => ({
        key: g.key,
        glCode: g.glCode,
      })),
      rowCount: rows.length,
      rows,
      note: "Thin MIS assemble — CAP-NFR-MIS PARTIAL, not certified BI.",
    };

    if (input.format === "csv") {
      const header = "journalId,reference,valueDate,type,status,createdAt";
      const lines = rows.map((r) =>
        [
          r.journalId,
          JSON.stringify(r.reference),
          r.valueDate,
          r.type,
          r.status,
          r.createdAt,
        ].join(","),
      );
      return {
        ...pack,
        exportFormat: "csv",
        csv: [header, ...lines].join("\n"),
      };
    }

    return { ...pack, exportFormat: "json" };
  }
}
