import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FatcaCrsClass,
  GlAccountType,
  LoanStatus,
  RegReportStatus,
  Prisma,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { InstitutionConfigService } from "../../common/institution-config.service";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import {
  assertLiveConfigured,
  cbarMode,
  ConfigError,
} from "../../integration/live-mode";
import { LedgerService } from "../../kernel/ledger/ledger.service";
import { filterRegTemplateCodesForInstitution } from "../../common/institution-type.util";
import {
  assembleGlReportPayload,
  buildLcrGlStub,
  parseRegReportDefinition,
  pickActiveRegReportTemplate,
  validateControlRatios,
  type CreditPortfolioCategoryRow,
  type TrialRow,
} from "./reg-report.engine";

@Injectable()
export class RegReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly institutionConfig: InstitutionConfigService,
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

    const institutionType = await this.institutionConfig.getInstitutionType();
    const allowedCodes = filterRegTemplateCodesForInstitution(institutionType, [
      template,
    ]);
    if (!allowedCodes.includes(template)) {
      throw new BadRequestException(
        `Template ${template} is not in the ${institutionType} report pack`,
      );
    }
    const templateRows = await this.prisma.regReportTemplate.findMany({
      where: { code: template },
    });
    const activeTemplate = pickActiveRegReportTemplate(
      templateRows.map((r) => ({
        id: r.id,
        code: r.code,
        version: r.version,
        validFrom: r.validFrom,
        institutionType: r.institutionType,
        definitionJson: r.definitionJson,
        outputFormat: r.outputFormat,
      })),
      institutionType,
      periodTo,
    );
    if (!activeTemplate) {
      throw new BadRequestException(
        `Unknown or missing CBAR template: ${template} (seed reg report templates)`,
      );
    }

    const definition = parseRegReportDefinition(activeTemplate.definitionJson);

    const trialBalance = await this.ledger.trialBalance(periodTo);
    const glAccounts = await this.prisma.glAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
    const glById = new Map(
      glAccounts.map((g: { id: string; code: string; name: string; type?: string }) => [
        g.id,
        g,
      ]),
    );

    const creditCategories =
      definition.assembly.kind === "CREDIT_PORTFOLIO_BY_CATEGORY" ||
      definition.assembly.kind === "CREDIT_PORTFOLIO_PLACEHOLDER"
        ? await this.loadPrudentialCreditCategories()
        : undefined;

    let outputJson: Record<string, unknown> = assembleGlReportPayload(
      template,
      definition,
      trialBalance,
      glById as Map<string, { code: string; name: string; type?: GlAccountType }>,
      activeTemplate.version,
      creditCategories,
    );

    if (definition.assembly.kind === "LCR_FROM_RISK_OR_GL") {
      outputJson = await this.mergeLcrOutput(
        template,
        trialBalance,
        glById as Map<string, { code: string; type: GlAccountType }>,
        outputJson,
      );
    } else if (definition.assembly.kind === "CAR_FROM_RISK") {
      outputJson = await this.mergeCarOutput(template, outputJson);
    }

    const validation = validateControlRatios(definition, outputJson);
    outputJson = {
      ...outputJson,
      controlValidation: validation,
    };

    const status = validation.passed
      ? RegReportStatus.VALIDATED
      : RegReportStatus.GENERATED;

    return this.prisma.regReportRun.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        templateCode: template,
        regReportTemplateId: activeTemplate.id,
        periodFrom,
        periodTo,
        status,
        outputJson: outputJson as Prisma.InputJsonValue,
      },
    });
  }

  async exportRun(runId: string, format: "csv" | "xml" | "json") {
    const run = await this.prisma.regReportRun.findFirst({
      where: { id: runId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!run) throw new NotFoundException("Reg report run not found");

    const mode = cbarMode();
    if (mode === "live" && run.templateCode.startsWith("CBAR_")) {
      assertLiveConfigured(
        mode,
        {
          BANK_CBAR_BASE_URL: process.env.BANK_CBAR_BASE_URL,
          BANK_CBAR_API_KEY: process.env.BANK_CBAR_API_KEY,
        },
        "BANK_CBAR_MODE=live",
      );
      throw new ConfigError(
        "BANK_CBAR_MODE=live requires live CBAR submit adapter (YC-E5)",
      );
    }

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

  async advanceFatcaWorkflow(
    customerId: string,
    target: FatcaCrsClass,
    reviewerUserId?: string,
  ) {
    const row = await this.upsertFatcaClassification(customerId, {
      classification: target,
      tinStatus: target === FatcaCrsClass.US_PERSON ? "REQUIRED" : "OPTIONAL",
    });
    return {
      ...row,
      workflow: "FATCA_CLASSIFICATION",
      reviewerUserId: reviewerUserId ?? "service",
      labOnly: true,
    };
  }

  async largeExposureReport(asOfDate = new Date()) {
    const loans = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.OVERDUE],
        },
      },
      select: { customerId: true, outstandingMinor: true, currency: true },
    });
    const byCustomer = new Map<string, bigint>();
    for (const loan of loans) {
      byCustomer.set(
        loan.customerId,
        (byCustomer.get(loan.customerId) ?? 0n) + loan.outstandingMinor,
      );
    }
    const tier1Stub = 10_000_000_000n;
    const thresholdMinor = tier1Stub / 4n;
    const exposures = [...byCustomer.entries()]
      .map(([customerId, exposureMinor]) => ({
        customerId,
        exposureMinor: exposureMinor.toString(),
        pctOfTier1: Number(exposureMinor) / Number(tier1Stub),
        large: exposureMinor >= thresholdMinor,
      }))
      .filter((e) => e.large)
      .sort((a, b) => Number(b.exposureMinor) - Number(a.exposureMinor));

    return this.prisma.regReportRun.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        templateCode: "LARGE_EXPOSURES",
        periodFrom: asOfDate,
        periodTo: asOfDate,
        status: RegReportStatus.GENERATED,
        outputJson: {
          template: "LARGE_EXPOSURES",
          asOfDate: asOfDate.toISOString().slice(0, 10),
          tier1CapitalStubMinor: tier1Stub.toString(),
          thresholdPct: 0.25,
          exposures,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async mergeLcrOutput(
    template: string,
    trialBalance: TrialRow[],
    glById: Map<string, { code: string; type: GlAccountType }>,
    base: Record<string, unknown>,
  ) {
    const snap = await this.prisma.liquidityGapSnapshot.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { asOfDate: "desc" },
    });
    const buckets = (snap?.bucketsJson ?? {}) as {
      lcrRatioStub?: number | null;
    };
    if (snap && buckets.lcrRatioStub != null) {
      return {
        ...base,
        source: "banking_risk via LiquidityGapSnapshot",
        gapSnapshotId: snap.id,
        asOfDate: snap.asOfDate.toISOString().slice(0, 10),
        lcrRatio: String(buckets.lcrRatioStub),
        awaitingRiskAssembly: false,
      };
    }
    return {
      ...buildLcrGlStub(template, trialBalance, glById),
      ...base,
      source: "gl_fallback",
      awaitingRiskAssembly: false,
    };
  }

  private async mergeCarOutput(template: string, base: Record<string, unknown>) {
    const car = await this.prisma.capitalAdequacySnapshot.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { asOfDate: "desc" },
    });
    if (!car) {
      return {
        ...base,
        note: "No CapitalAdequacySnapshot — run POST /risk/capital/run",
        carRatio: null,
        awaitingRiskAssembly: false,
      };
    }
    return {
      ...base,
      template,
      source: "banking_risk.CapitalAdequacySnapshot",
      asOfDate: car.asOfDate.toISOString().slice(0, 10),
      carRatio: car.carRatio,
      tier1Ratio: car.tier1Ratio,
      rwaMinor: car.rwaMinor.toString(),
      tier1CapitalMinor: car.tier1CapitalMinor.toString(),
      awaitingRiskAssembly: false,
    };
  }

  async listCbarTemplates() {
    const institutionType = await this.institutionConfig.getInstitutionType();
    const rows = await this.prisma.regReportTemplate.findMany({
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
    const codes = [...new Set(rows.map((r) => r.code))];
    const allowed = new Set(
      filterRegTemplateCodesForInstitution(institutionType, codes),
    );
    return rows
      .filter(
        (r) =>
          allowed.has(r.code) &&
          (r.institutionType == null || r.institutionType === institutionType),
      )
      .map((r) => ({
        id: r.id,
        code: r.code,
        version: r.version,
        institutionType: r.institutionType,
        outputFormat: r.outputFormat,
        labExportOnly: true,
      }));
  }

  private async loadPrudentialCreditCategories(): Promise<
    CreditPortfolioCategoryRow[]
  > {
    const run = await this.prisma.prudentialClassificationRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      include: { results: true },
    });
    if (!run?.results.length) return [];
    const loanIds = run.results.map((r) => r.loanId);
    const loans = await this.prisma.loanContract.findMany({
      where: { id: { in: loanIds }, bankOrgId: this.bankOrg.bankOrgId },
      select: { id: true, outstandingMinor: true },
    });
    const outstandingByLoan = new Map(
      loans.map((l) => [l.id, l.outstandingMinor]),
    );
    const byCat = new Map<
      string,
      { outstanding: bigint; provision: bigint; count: number }
    >();
    for (const r of run.results) {
      const key = String(r.category);
      const cur = byCat.get(key) ?? {
        outstanding: 0n,
        provision: 0n,
        count: 0,
      };
      cur.provision += r.provisionMinor;
      cur.outstanding += outstandingByLoan.get(r.loanId) ?? 0n;
      cur.count += 1;
      byCat.set(key, cur);
    }
    return [...byCat.entries()].map(([categoryCode, v]) => ({
      categoryCode,
      outstandingMinor: v.outstanding.toString(),
      provisionMinor: v.provision.toString(),
      loanCount: v.count,
    }));
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