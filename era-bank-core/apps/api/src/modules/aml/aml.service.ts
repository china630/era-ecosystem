import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AmlAlertStatus,
  AmlSeverity,
  FmnReportStatus,
  Prisma,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { assertAlertStatusTransition } from "./aml-workflow";
import { scoreSanctionMatch } from "./aml-rules.engine";
import sanctionsSeed from "./sanctions-seed.json";

const SCREEN_THRESHOLD = 80;

type SanctionEntry = { listSource: string; name: string };

@Injectable()
export class AmlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listAlerts(filters?: {
    status?: AmlAlertStatus;
    severity?: AmlSeverity;
    from?: Date;
    to?: Date;
  }) {
    return this.prisma.amlAlert.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: filters?.status,
        severity: filters?.severity,
        createdAt: filters?.from || filters?.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getAlert(id: string) {
    const alert = await this.prisma.amlAlert.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { screeningHits: true },
    });
    if (!alert) throw new NotFoundException("AML alert not found");

    const transaction = alert.transactionId
      ? await this.prisma.journalTransaction.findFirst({
          where: { id: alert.transactionId, bankOrgId: this.bankOrg.bankOrgId },
          include: { entries: true },
        })
      : null;

    return { ...alert, transaction };
  }

  async patchAlert(
    id: string,
    input: {
      status?: AmlAlertStatus;
      assignedToUserId?: string;
      resolutionNote?: string;
    },
  ) {
    const alert = await this.prisma.amlAlert.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!alert) throw new NotFoundException("AML alert not found");

    if (input.status) {
      try {
        assertAlertStatusTransition(alert.status, input.status);
      } catch {
        throw new BadRequestException(
          `Invalid status transition: ${alert.status} → ${input.status}`,
        );
      }
    }

    return this.prisma.amlAlert.update({
      where: { id },
      data: {
        status: input.status,
        assignedToUserId: input.assignedToUserId,
        resolutionNote: input.resolutionNote,
        closedAt:
          input.status === AmlAlertStatus.CLOSED || input.status === AmlAlertStatus.ESCALATED
            ? new Date()
            : undefined,
      },
    });
  }

  async escalateAlert(id: string, note?: string) {
    return this.patchAlert(id, {
      status: AmlAlertStatus.ESCALATED,
      resolutionNote: note,
    });
  }

  listRules() {
    return this.prisma.amlRule.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { code: "asc" },
    });
  }

  async updateRule(code: string, input: { enabled?: boolean; paramsJson?: Record<string, unknown> }) {
    const rule = await this.prisma.amlRule.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code },
    });
    if (!rule) throw new NotFoundException(`AML rule ${code} not found`);

    return this.prisma.amlRule.update({
      where: { id: rule.id },
      data: {
        enabled: input.enabled,
        paramsJson: input.paramsJson
          ? (input.paramsJson as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async screen(input: { name: string; listSource?: string; alertId?: string }) {
    const matches = (sanctionsSeed as SanctionEntry[])
      .filter((e) => !input.listSource || e.listSource === input.listSource)
      .map((entry) => ({
        entry,
        score: scoreSanctionMatch(input.name, entry.name),
      }))
      .filter((m) => m.score >= 50)
      .sort((a, b) => b.score - a.score);

    const best = matches[0];
    const score = best?.score ?? 10;
    const matchedName = best?.entry.name ?? input.name;
    const listSource = best?.entry.listSource ?? input.listSource ?? "LOCAL";

    const hit = await this.prisma.amlScreeningHit.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        alertId: input.alertId,
        listSource,
        matchedName,
        matchScore: score,
        cleared: score < SCREEN_THRESHOLD,
      },
    });

    if (input.alertId && score >= SCREEN_THRESHOLD) {
      await this.prisma.amlAlert.updateMany({
        where: { id: input.alertId, bankOrgId: this.bankOrg.bankOrgId },
        data: { severity: AmlSeverity.HIGH },
      });
    }

    return { hit, matches: matches.slice(0, 5) };
  }

  raiseAlert(input: {
    ruleCode: string;
    narrative: string;
    severity?: AmlSeverity;
    customerId?: string;
    transactionId?: string;
    amountMinor?: bigint;
    currency?: string;
    counterpartyRef?: string;
  }) {
    return this.prisma.amlAlert.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: AmlAlertStatus.OPEN,
        severity: input.severity ?? AmlSeverity.MEDIUM,
        ruleCode: input.ruleCode,
        narrative: input.narrative,
        customerId: input.customerId,
        transactionId: input.transactionId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        counterpartyRef: input.counterpartyRef,
      },
    });
  }

  async createFmnReport(input: {
    periodFrom: Date;
    periodTo: Date;
    alertIds?: string[];
    filedByUserId?: string;
  }) {
    const alertFilter: Prisma.AmlAlertWhereInput = {
      bankOrgId: this.bankOrg.bankOrgId,
      createdAt: { gte: input.periodFrom, lte: input.periodTo },
    };
    if (input.alertIds?.length) {
      alertFilter.id = { in: input.alertIds };
    } else {
      alertFilter.status = AmlAlertStatus.ESCALATED;
    }

    const alerts = await this.prisma.amlAlert.findMany({
      where: alertFilter,
      include: { screeningHits: true },
    });

    const institutionMfo = process.env.ERA_BANK_MFO ?? "200001";
    const payload = {
      schemaVersion: "FMN-TEST-1",
      institutionMfo,
      reportType: "SUSPICIOUS_TRANSACTION",
      periodFrom: input.periodFrom.toISOString(),
      periodTo: input.periodTo.toISOString(),
      listVersion: "sanctions-seed-v1",
      suspiciousTransactions: alerts.map((a) => ({
        alertId: a.id,
        ruleCode: a.ruleCode,
        transactionId: a.transactionId,
        customerId: a.customerId,
        amountMinor: a.amountMinor?.toString() ?? null,
        currency: a.currency,
        narrative: a.narrative,
        screeningHitCount: a.screeningHits.length,
      })),
    };

    return this.prisma.fmnReport.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        status: FmnReportStatus.DRAFT,
        payloadJson: payload as Prisma.InputJsonValue,
        filedByUserId: input.filedByUserId,
      },
    });
  }

  async exportFmnReport(id: string, format: "json" | "xml") {
    const report = await this.prisma.fmnReport.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!report) throw new NotFoundException("FMN report not found");

    if (format === "json") {
      return {
        contentType: "application/json",
        body: JSON.stringify(report.payloadJson, null, 2),
      };
    }

    const payload = report.payloadJson as Record<string, unknown>;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<fmnReport>\n  <institutionMfo>${payload.institutionMfo ?? ""}</institutionMfo>\n  <reportType>${payload.reportType ?? ""}</reportType>\n  <periodFrom>${payload.periodFrom ?? ""}</periodFrom>\n  <periodTo>${payload.periodTo ?? ""}</periodTo>\n</fmnReport>`;
    return { contentType: "application/xml", body: xml };
  }
}
