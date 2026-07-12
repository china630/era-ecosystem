import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LedgerType, Prisma } from "@erafinance/database";
import { AccessControlService } from "../access/access-control.service";
import { BankBalancesSyncQueueService } from "../banking/bank-balances-sync.queue";
import { BankingGatewayService } from "../banking/banking-gateway.service";
import { CurrencyConverterService } from "../fx/currency-converter.service";
import { CbarExternalFetchDisabledError } from "../fx/cbar-errors";
import {
  OrchestratorHoldingsClientService,
  type ControlPlaneHolding,
} from "../orchestrator/orchestrator-holdings-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportingService } from "../reporting/reporting.service";
import { TaxpayerIntegrationService } from "../tax/taxpayer-integration.service";
import {
  accrualMonthSlices,
  parseIsoDateOnly,
} from "../reporting/reporting-period.util";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { decodeOrganizationTaxId, decryptText } from "../security/pii-crypto.util";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

type HoldingOrgRow = {
  id: string;
  name: string;
  currency: string;
  taxIdCipher: string | null;
  taxIdBlindIndex: string | null;
};

@Injectable()
export class HoldingsReportingService {
  private readonly logger = new Logger(HoldingsReportingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly reporting: ReportingService,
    private readonly currency: CurrencyConverterService,
    private readonly bankingGateway: BankingGatewayService,
    private readonly bankSyncQueue: BankBalancesSyncQueueService,
    private readonly taxpayerIntegration: TaxpayerIntegrationService,
    private readonly holdingsCp: OrchestratorHoldingsClientService,
  ) {}

  private async loadHoldingOrgs(
    holding: ControlPlaneHolding,
  ): Promise<HoldingOrgRow[]> {
    if (holding.organizationIds.length === 0) return [];
    const orgs = await this.prisma.organization.findMany({
      where: {
        id: { in: holding.organizationIds },
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        currency: true,
        taxIdCipher: true,
        taxIdBlindIndex: true,
      },
    });
    const byId = new Map(orgs.map((o) => [o.id, o]));
    return holding.organizationIds
      .map((id) => byId.get(id))
      .filter((o): o is HoldingOrgRow => o != null);
  }

  private async resolveHolding(
    userId: string,
    holdingId: string,
  ): Promise<{ holding: ControlPlaneHolding; organizations: HoldingOrgRow[] }> {
    await this.access.assertMayViewHoldingReports(userId, holdingId);
    const holding = await this.holdingsCp.getHoldingForUser(userId, holdingId);
    if (!holding.canViewReports) {
      throw new NotFoundException(`Holding with ID ${holdingId} not found`);
    }
    const organizations = await this.loadHoldingOrgs(holding);
    return { holding, organizations };
  }

  async getHoldingBalancesSummaryForUser(userId: string, holdingId: string) {
    return this.getHoldingBalancesSummary(userId, holdingId);
  }

  async getHoldingBalancesSummary(userId: string, holdingId: string): Promise<{
    holdingId: string;
    holdingName: string;
    holdingBaseCurrency: string;
    fxAsOfDate: string;
    totalInHoldingBase: string | null;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      currency: string;
      amount: string;
      amountInHoldingBase: string | null;
      providers: string[];
      accountsCount: number;
    }>;
    consolidationNote: string | null;
  }> {
    const { holding, organizations: orgs } = await this.resolveHolding(
      userId,
      holdingId,
    );

    const baseCur = (holding.baseCurrency ?? "AZN").toUpperCase();
    const asOfDate = new Date();
    let fxNote: string | null = null;
    let totalInBase = new Decimal(0);

    const organizations = [];
    for (const org of orgs) {
      const cur = (org.currency ?? "AZN").toUpperCase();
      const balances = await this.bankingGateway.getBalances(org.id);
      const amount = balances.balances.reduce(
        (acc, item) =>
          item.currency.toUpperCase() === cur
            ? acc.plus(new Decimal(item.amount))
            : acc,
        new Decimal(0),
      );
      const row = {
        organizationId: org.id,
        organizationName: org.name,
        currency: cur,
        amount: amount.toFixed(4),
        amountInHoldingBase: null as string | null,
        providers: balances.providers.map((p) => p.provider),
        accountsCount: balances.balances.length,
      };
      try {
        const converted = await this.currency.convert(
          amount,
          cur,
          baseCur,
          asOfDate,
        );
        const rounded = new Decimal(converted.toFixed(4));
        totalInBase = totalInBase.plus(rounded);
        row.amountInHoldingBase = rounded.toFixed(4);
      } catch (e) {
        if (e instanceof CbarExternalFetchDisabledError) {
          fxNote =
            "CBAR rates are unavailable (offline/mock): conversion to holding base currency was skipped.";
          row.amountInHoldingBase = null;
        } else {
          this.logger.warn(
            `Holding bank aggregation FX failed: org=${org.id} ${cur}->${baseCur}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          row.amountInHoldingBase = null;
        }
      }
      organizations.push(row);
    }

    return {
      holdingId: holding.id,
      holdingName: holding.name,
      holdingBaseCurrency: baseCur,
      fxAsOfDate: asOfDate.toISOString().slice(0, 10),
      totalInHoldingBase: fxNote ? null : totalInBase.toFixed(4),
      organizations,
      consolidationNote: fxNote,
    };
  }

  async getHoldingTaxRiskMonitor(userId: string, holdingId: string): Promise<{
    holdingId: string;
    riskyCounterparties: Array<{
      organizationId: string;
      organizationName: string;
      counterpartyId: string;
      name: string;
      taxId: string;
      isRiskyTaxpayer: boolean | null;
    }>;
  }> {
    const { organizations: orgs } = await this.resolveHolding(userId, holdingId);
    const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
    const orgIds = orgs.map((o) => o.id);
    const counterparties = await this.prisma.counterparty.findMany({
      where: { organizationId: { in: orgIds } },
      select: {
        id: true,
        organizationId: true,
        nameCipher: true,
        taxIdCipher: true,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    const riskyCounterparties = [];
    for (const cp of counterparties) {
      const taxId = cp.taxIdCipher ? decryptText(cp.taxIdCipher) ?? "" : "";
      if (!/^\d{10}$/.test(taxId)) continue;
      try {
        const lookup = await this.taxpayerIntegration.lookupTaxpayerByVoen(taxId);
        if (lookup.isRiskyTaxpayer !== true) continue;
        riskyCounterparties.push({
          organizationId: cp.organizationId,
          organizationName: orgNameById.get(cp.organizationId) ?? "—",
          counterpartyId: cp.id,
          name: cp.nameCipher ? decryptText(cp.nameCipher) ?? "" : "",
          taxId,
          isRiskyTaxpayer: lookup.isRiskyTaxpayer,
        });
      } catch (e) {
        this.logger.warn(
          `Holding tax risk lookup failed taxId=${taxId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    return {
      holdingId,
      riskyCounterparties,
    };
  }

  async triggerManualBankSync(userId: string, holdingId: string): Promise<{
    queued: number;
    holdingId: string;
  }> {
    const { organizations: orgs } = await this.resolveHolding(userId, holdingId);
    const queued = await this.bankSyncQueue.enqueueManualSync({
      organizationIds: orgs.map((o) => o.id),
      triggeredByUserId: userId,
      source: "holding-dashboard",
    });
    return { queued: queued.queued, holdingId };
  }

  async getHoldingSummary(
    userId: string,
    holdingId: string,
    params?: { asOf?: string; ledgerType?: LedgerType },
  ) {
    const { holding, organizations: orgs } = await this.resolveHolding(
      userId,
      holdingId,
    );

    const baseCur = (holding.baseCurrency ?? "AZN").toUpperCase();
    const ledgerType = params?.ledgerType ?? LedgerType.NAS;
    let asOfDate: Date;
    try {
      asOfDate = params?.asOf ? parseIsoDateOnly(params.asOf) : new Date();
    } catch {
      asOfDate = new Date();
    }

    let fxNote: string | null = null;
    let totalCashBankInBase = new Decimal(0);
    const organizations: Array<{
      organizationId: string;
      organizationName: string;
      taxId: string;
      currency: string;
      cashBankBalance: string;
      cashBankInHoldingBase: string | null;
    }> = [];

    for (const org of orgs) {
      const cur = (org.currency ?? "AZN").toUpperCase();
      const dash = await runWithTenantContextAsync(
        { organizationId: org.id, skipTenantFilter: false },
        () => this.reporting.dashboard(org.id, ledgerType),
      );
      const cash = new Decimal(dash.cashBankBalance);
      const row = {
        organizationId: org.id,
        organizationName: org.name,
        taxId: decodeOrganizationTaxId(org),
        currency: cur,
        cashBankBalance: cash.toFixed(4),
        cashBankInHoldingBase: null as string | null,
      };
      try {
        const inBaseRaw = await this.currency.convert(
          cash,
          cur,
          baseCur,
          asOfDate,
        );
        const inBaseRounded = new Decimal(inBaseRaw.toFixed(4));
        totalCashBankInBase = totalCashBankInBase.add(inBaseRounded);
        row.cashBankInHoldingBase = inBaseRounded.toFixed(4);
      } catch (e) {
        if (e instanceof CbarExternalFetchDisabledError) {
          fxNote =
            "Курсы ЦБА недоступны (TAX_LOOKUP_MOCK / офлайн): конвертация в базовую валюту не выполнена.";
          row.cashBankInHoldingBase = null;
          this.logger.warn(
            `Holding summary FX disabled: org=${org.id} ${cur}->${baseCur} asOf=${asOfDate.toISOString().slice(0, 10)}`,
          );
        } else {
          this.logger.warn(
            `Holding summary FX failed: org=${org.id} ${cur}->${baseCur} asOf=${asOfDate.toISOString().slice(0, 10)}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          row.cashBankInHoldingBase = null;
        }
      }
      organizations.push(row);
    }

    return {
      holdingId: holding.id,
      holdingName: holding.name,
      holdingBaseCurrency: baseCur,
      fxAsOfDate: asOfDate.toISOString().slice(0, 10),
      totalCashBankInHoldingBase: fxNote ? null : totalCashBankInBase.toFixed(4),
      organizations,
      consolidationNote: fxNote,
    };
  }

  async consolidatedProfitAndLoss(
    userId: string,
    holdingId: string,
    dateFrom: string,
    dateTo: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const { holding, organizations: orgs } = await this.resolveHolding(
      userId,
      holdingId,
    );

    const baseCur = (holding.baseCurrency ?? "AZN").toUpperCase();
    let dateFromD: Date;
    let dateToD: Date;
    try {
      dateFromD = parseIsoDateOnly(dateFrom);
      dateToD = parseIsoDateOnly(dateTo);
    } catch {
      dateFromD = new Date();
      dateToD = new Date();
    }
    let fxSlices = accrualMonthSlices(dateFromD, dateToD);
    if (fxSlices.length === 0) {
      fxSlices = [{ fromStr: dateFrom, toStr: dateTo, fxAsOf: dateToD }];
    }

    const organizations = [];
    const totalsByCurrency = new Map<string, Decimal>();
    let consolidatedNetProfitInBase = new Decimal(0);
    let fxNote: string | null = null;

    for (const org of orgs) {
      const pnl = await this.reporting.profitAndLoss(
        org.id,
        dateFrom,
        dateTo,
        ledgerType,
        null,
      );
      const np = new Decimal(pnl.netProfit);
      const cur = (org.currency ?? "AZN").toUpperCase();
      organizations.push({
        organizationId: org.id,
        organizationName: org.name,
        taxId: decodeOrganizationTaxId(org),
        currency: cur,
        netProfit: pnl.netProfit,
        netProfitInHoldingBase: null as string | null,
      });
      totalsByCurrency.set(
        cur,
        (totalsByCurrency.get(cur) ?? new Decimal(0)).plus(np),
      );

      try {
        let inBaseSum = new Decimal(0);
        for (const seg of fxSlices) {
          const pnlSeg = await this.reporting.profitAndLoss(
            org.id,
            seg.fromStr,
            seg.toStr,
            ledgerType,
            null,
          );
          const npSeg = new Decimal(pnlSeg.netProfit);
          const part = await this.currency.convert(
            npSeg,
            cur,
            baseCur,
            seg.fxAsOf,
          );
          inBaseSum = inBaseSum.add(part);
        }
        consolidatedNetProfitInBase = consolidatedNetProfitInBase.add(inBaseSum);
        const last = organizations[organizations.length - 1]!;
        last.netProfitInHoldingBase = inBaseSum.toFixed(4);
      } catch (e) {
        if (e instanceof CbarExternalFetchDisabledError) {
          fxNote =
            "Курсы ЦБА недоступны (TAX_LOOKUP_MOCK / офлайн): консолидация в базовую валюту не выполнена.";
          const last = organizations[organizations.length - 1]!;
          last.netProfitInHoldingBase = null;
        } else {
          this.logger.warn(
            `Holding consolidated P&L FX failed: org=${org.id} ${cur}->${baseCur}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          fxNote =
            fxNote ??
            "Конвертация в валюту холдинга не выполнена для одной или нескольких организаций; итог в базовой валюте опущен.";
          const last = organizations[organizations.length - 1]!;
          last.netProfitInHoldingBase = null;
        }
      }
    }

    const consolidatedNetProfitByCurrency: Record<string, string> = {};
    for (const [c, v] of totalsByCurrency) {
      consolidatedNetProfitByCurrency[c] = v.toFixed(4);
    }

    return {
      holdingId: holding.id,
      holdingName: holding.name,
      holdingBaseCurrency: baseCur,
      consolidationFxMode: "monthly_slice_end_rate" as const,
      consolidationFxSlices: fxSlices.length,
      dateFrom,
      dateTo,
      ledgerType,
      organizations,
      consolidatedNetProfitByCurrency,
      consolidatedNetProfitInHoldingBase: fxNote
        ? null
        : consolidatedNetProfitInBase.toFixed(4),
      consolidationNote:
        fxNote ??
        "Чистая прибыль за каждый календарный фрагмент месяца внутри периода переводится в валюту холдинга по курсу ЦБА на последний день фрагмента; суммы по фрагментам складываются.",
    };
  }
}
