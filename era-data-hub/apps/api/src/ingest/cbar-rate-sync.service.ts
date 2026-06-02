import { Injectable, Logger } from "@nestjs/common";
import { CbarRateStatus, Prisma } from "@era/data-hub-database";
import { PrismaHubService } from "../prisma/prisma-hub.service";
import { HubFxConfigService } from "./hub-fx-config.service";
import { CbarFxService, type ParsedCbarDoc } from "./cbar-fx.service";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

function eqValue4(a: Prisma.Decimal | number, b: Prisma.Decimal | number): boolean {
  const da = a instanceof Decimal ? a : new Decimal(a);
  const db = b instanceof Decimal ? b : new Decimal(b);
  return da.toDecimalPlaces(4).equals(db.toDecimalPlaces(4));
}

/** DD.MM.YYYY из XML → дата для @db.Date (UTC полдень). */
export function bakuDdMmYyyyToRateDate(ddMmYyyy: string): Date {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(ddMmYyyy.trim());
  if (!m) {
    throw new Error(`Invalid CBAR date: ${ddMmYyyy}`);
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function previousUtcDate(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1, 12, 0, 0, 0),
  );
}

/**
 * CBAR ingest into era_data_hub (hub SoR only).
 */
@Injectable()
export class CbarRateSyncService {
  private readonly logger = new Logger(CbarRateSyncService.name);

  constructor(
    private readonly hub: PrismaHubService,
    private readonly cbar: CbarFxService,
    private readonly fxConfig: HubFxConfigService,
  ) {}

  async syncTodayFromCbar(): Promise<void> {
    if (!this.cbar.isExternalCbarFetchEnabled()) {
      return;
    }
    await this.ingestFromNetworkAnchor(new Date());
  }

  async ingestFromNetworkAnchor(
    anchorDate: Date,
    opts?: { skipCalendarTodayDbGuard?: boolean },
  ): Promise<void> {
    if (!this.cbar.isExternalCbarFetchEnabled()) {
      return;
    }
    const bakuKey = this.cbar.formatBakuDate(anchorDate);
    const todayRateDate = bakuDdMmYyyyToRateDate(bakuKey);
    if (!opts?.skipCalendarTodayDbGuard) {
      const existingUsd = await this.hub.cbarOfficialRate.findUnique({
        where: {
          rateDate_currencyCode: {
            rateDate: todayRateDate,
            currencyCode: "USD",
          },
        },
      });
      if (existingUsd?.status === CbarRateStatus.FINAL) {
        this.logger.debug(
          `CBAR ingest skip: FINAL USD already stored for calendar ${bakuKey} (no HTTP)`,
        );
        return;
      }
    }
    const url = this.cbar.buildCbarUrl(anchorDate);
    const body = await this.cbar.fetchCbarXmlBodyForDate(anchorDate);
    if (!body) {
      this.logger.debug("CBAR sync: no document / no Date attribute");
      return;
    }
    const doc = this.cbar.parseCbarXmlLogged(body, url);
    if (!doc?.publishedDateBaku) {
      this.logger.debug("CBAR sync: no document / no Date attribute");
      return;
    }
    await this.persistParsedDoc(doc);
  }

  async persistParsedDoc(doc: ParsedCbarDoc): Promise<void> {
    const pub = doc.publishedDateBaku;
    if (!pub) return;
    const rateDate = bakuDdMmYyyyToRateDate(pub);
    const status = await this.resolveStatusForDay(rateDate, doc);

    for (const r of doc.rates) {
      const code = r.code.trim().toUpperCase();
      if (!code) continue;
      const value = new Decimal(r.value);
      const rate = new Decimal(r.rate);
      await this.hub.cbarOfficialRate.upsert({
        where: {
          rateDate_currencyCode: { rateDate, currencyCode: code },
        },
        create: {
          rateDate,
          currencyCode: code,
          value,
          nominal: r.nominal,
          rate,
          status,
        },
        update: {
          value,
          nominal: r.nominal,
          rate,
          status,
        },
      });
    }

    this.logger.log(
      `CBAR rates upserted date=${pub} rows=${doc.rates.length} status=${status}`,
    );
  }

  private async resolveStatusForDay(
    rateDate: Date,
    doc: ParsedCbarDoc,
  ): Promise<CbarRateStatus> {
    const existing = await this.hub.cbarOfficialRate.findFirst({
      where: { rateDate },
    });
    if (existing?.status === CbarRateStatus.FINAL) {
      return CbarRateStatus.FINAL;
    }

    if (existing?.status === CbarRateStatus.PRELIMINARY) {
      if (await this.storedMainChangedVsDoc(doc, rateDate)) {
        return CbarRateStatus.FINAL;
      }
    }

    const prevDate = previousUtcDate(rateDate);
    const prevUsd = await this.hub.cbarOfficialRate.findUnique({
      where: {
        rateDate_currencyCode: {
          rateDate: prevDate,
          currencyCode: "USD",
        },
      },
    });
    const prevEur = await this.hub.cbarOfficialRate.findUnique({
      where: {
        rateDate_currencyCode: {
          rateDate: prevDate,
          currencyCode: "EUR",
        },
      },
    });

    const newUsd = doc.rates.find((x) => x.code.toUpperCase() === "USD");
    const newEur = doc.rates.find((x) => x.code.toUpperCase() === "EUR");

    if (!prevUsd || !prevEur || !newUsd || !newEur) {
      return CbarRateStatus.FINAL;
    }

    const usdMatch = eqValue4(prevUsd.value, newUsd.value);
    const eurMatch = eqValue4(prevEur.value, newEur.value);
    if (usdMatch && eurMatch) {
      return CbarRateStatus.PRELIMINARY;
    }
    return CbarRateStatus.FINAL;
  }

  private async storedMainChangedVsDoc(
    doc: ParsedCbarDoc,
    rateDate: Date,
  ): Promise<boolean> {
    const checkCodes = this.fxConfig.getFxCbarCheckCurrencyCodes();
    for (const code of checkCodes) {
      const row = await this.hub.cbarOfficialRate.findUnique({
        where: {
          rateDate_currencyCode: { rateDate, currencyCode: code },
        },
      });
      const fresh = doc.rates.find((x) => x.code.toUpperCase() === code);
      if (row && fresh && !eqValue4(row.value, fresh.value)) {
        return true;
      }
    }
    return false;
  }
}
