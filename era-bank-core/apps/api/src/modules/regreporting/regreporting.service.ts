import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FatcaCrsClass,
  GlAccountType,
  RegReportStatus,
  Prisma,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import { LedgerService } from "../../kernel/ledger/ledger.service";

type TrialRow = {
  glAccountId: string;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
};

@Injectable()
export class RegReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly ledger: LedgerService,
    private readonly events: OrchestratorEventsPublisher,
  ) {}

  async generateCbar(template: string, periodFrom: Date, periodTo: Date) {
    const existing = await this.prisma.regReportRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        templateCode: template,
        periodFrom,
        periodTo,
      },
    });
    if (existing) return existing;

    const trialBalance = await this.ledger.trialBalance(periodTo);
    const glAccounts = await this.prisma.glAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
    const glById = new Map(glAccounts.map((g) => [g.id, g]));

    let outputJson: Record<string, unknown>;

    switch (template) {
      case "CBAR_TRIAL_BALANCE":
        outputJson = this.buildTrialBalanceOutput(template, trialBalance, glById);
        break;
      case "CBAR_BALANCE_SHEET_STUB":
        outputJson = this.buildBalanceSheetStub(template, trialBalance, glById);
        break;
      case "CBAR_LCR_STUB":
        outputJson = this.buildLcrStub(template, trialBalance, glById);
        break;
      default:
        throw new BadRequestException(`Unknown CBAR template: ${template}`);
    }

    return this.prisma.regReportRun.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        templateCode: template,
        periodFrom,
        periodTo,
        status: RegReportStatus.GENERATED,
        outputJson: outputJson as Prisma.InputJsonValue,
      },
    });
  }

  async exportRun(runId: string, format: "csv" | "xml" | "json") {
    const run = await this.prisma.regReportRun.findFirst({
      where: { id: runId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!run) throw new NotFoundException("Reg report run not found");

    await this.prisma.regReportRun.update({
      where: { id: runId },
      data: { status: RegReportStatus.EXPORTED, exportedAt: new Date() },
    });

    await this.events.publishRegReportExported({
      runId: run.id,
      templateCode: run.templateCode,
      periodFrom: run.periodFrom.toISOString(),
      periodTo: run.periodTo.toISOString(),
      format,
    });

    const output = run.outputJson as Record<string, unknown>;
    if (format === "json") {
      return { contentType: "application/json", body: JSON.stringify(output, null, 2) };
    }
    if (format === "csv") {
      return { contentType: "text/csv", body: this.toCsv(output) };
    }
    return { contentType: "application/xml", body: this.toXml(run.templateCode, output) };
  }

  async fatcaCrsReport(period: Date) {
    const classifications = await this.prisma.fatcaCrsClassification.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
    const reportable = classifications.filter(
      (c) =>
        c.classification === FatcaCrsClass.US_PERSON ||
        c.classification === FatcaCrsClass.REPORTABLE,
    );

    return this.prisma.regReportRun.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        templateCode: "FATCA_CRS",
        periodFrom: period,
        periodTo: period,
        status: RegReportStatus.GENERATED,
        outputJson: {
          template: "FATCA_CRS",
          asOf: period.toISOString(),
          reportablePersons: reportable.map((r) => ({
            customerId: r.customerId,
            classification: r.classification,
            tinStatus: r.tinStatus,
          })),
        } as Prisma.InputJsonValue,
      },
    });
  }

  fatcaCrsList() {
    return this.prisma.fatcaCrsClassification.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsertFatcaClassification(
    customerId: string,
    input: { classification: FatcaCrsClass; tinStatus?: string },
  ) {
    return this.prisma.fatcaCrsClassification.upsert({
      where: {
        bankOrgId_customerId: { bankOrgId: this.bankOrg.bankOrgId, customerId },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId,
        classification: input.classification,
        tinStatus: input.tinStatus,
      },
      update: {
        classification: input.classification,
        tinStatus: input.tinStatus,
      },
    });
  }

  private buildTrialBalanceOutput(
    template: string,
    trialBalance: TrialRow[],
    glById: Map<string, { code: string; name: string }>,
  ) {
    const lines = trialBalance.map((row) => ({
      glCode: glById.get(row.glAccountId)?.code ?? row.glAccountId,
      glName: glById.get(row.glAccountId)?.name ?? "",
      debitMinor: row.debitMinor.toString(),
      creditMinor: row.creditMinor.toString(),
      currency: row.currency,
    }));
    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const row of trialBalance) {
      totalDebit += row.debitMinor;
      totalCredit += row.creditMinor;
    }
    return {
      template,
      lines,
      totals: {
        debitMinor: totalDebit.toString(),
        creditMinor: totalCredit.toString(),
        balanced: totalDebit === totalCredit,
      },
    };
  }

  private buildBalanceSheetStub(
    template: string,
    trialBalance: TrialRow[],
    glById: Map<string, { code: string; name: string; type: GlAccountType }>,
  ) {
    const buckets: Record<string, bigint> = {
      ASSET: 0n,
      LIABILITY: 0n,
      EQUITY: 0n,
    };
    for (const row of trialBalance) {
      const gl = glById.get(row.glAccountId);
      if (!gl) continue;
      if (gl.type === GlAccountType.ASSET) buckets.ASSET += row.debitMinor - row.creditMinor;
      if (gl.type === GlAccountType.LIABILITY) buckets.LIABILITY += row.creditMinor - row.debitMinor;
      if (gl.type === GlAccountType.EQUITY) buckets.EQUITY += row.creditMinor - row.debitMinor;
    }
    return {
      template,
      aggregated: Object.entries(buckets).map(([type, netMinor]) => ({
        type,
        netMinor: netMinor.toString(),
      })),
    };
  }

  private buildLcrStub(
    template: string,
    trialBalance: TrialRow[],
    glById: Map<string, { code: string; type: GlAccountType }>,
  ) {
    let liquidAssets = 0n;
    let outflows = 0n;
    for (const row of trialBalance) {
      const gl = glById.get(row.glAccountId);
      if (!gl) continue;
      if (gl.code.startsWith("100") || gl.code.startsWith("161")) {
        liquidAssets += row.debitMinor - row.creditMinor;
      }
      if (gl.type === GlAccountType.LIABILITY) {
        outflows += row.creditMinor - row.debitMinor;
      }
    }
    const ratio = outflows > 0n ? Number(liquidAssets) / Number(outflows) : 1;
    return {
      template,
      formula: "liquidAssets / liabilityOutflows (stub)",
      liquidAssetsMinor: liquidAssets.toString(),
      outflowsMinor: outflows.toString(),
      lcrRatio: ratio.toFixed(4),
    };
  }

  private toCsv(output: Record<string, unknown>): string {
    const lines = (output.lines as Array<Record<string, string>> | undefined) ?? [];
    if (lines.length === 0) return "key,value\n";
    const headers = Object.keys(lines[0]);
    const rows = lines.map((line) => headers.map((h) => line[h] ?? "").join(","));
    return [headers.join(","), ...rows].join("\n");
  }

  private toXml(templateCode: string, output: Record<string, unknown>): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<regReport template="${templateCode}">\n  <payload>${JSON.stringify(output)}</payload>\n</regReport>`;
  }
}
