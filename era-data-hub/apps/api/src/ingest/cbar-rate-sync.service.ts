import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { CbarRateStatus, Prisma } from "@era/data-hub-database";

const Decimal = Prisma.Decimal;
import { PrismaHubService } from "../prisma/prisma-hub.service";
import { CbarFxService, type ParsedCbarDoc } from "./cbar-fx.service";

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

/**
 * CBAR ingest into era_data_hub (hub SoR only).
 * The XML `Date` attribute is the rate day. An unchanged value versus yesterday is still FINAL.
 */
@Injectable()
export class CbarRateSyncService implements OnModuleInit {
  private readonly logger = new Logger(CbarRateSyncService.name);

  constructor(
    private readonly hub: PrismaHubService,
    private readonly cbar: CbarFxService,
  ) {}

  /** Rows stored as PRELIMINARY only because USD/EUR matched the previous day. */
  async onModuleInit(): Promise<void> {
    const promoted = await this.hub.cbarOfficialRate.updateMany({
      where: { status: CbarRateStatus.PRELIMINARY },
      data: { status: CbarRateStatus.FINAL },
    });
    if (promoted.count > 0) {
      this.logger.log(
        `CBAR promoted ${promoted.count} PRELIMINARY rows to FINAL (unchanged rate is official)`,
      );
    }
  }

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
    const status = CbarRateStatus.FINAL;

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
}
