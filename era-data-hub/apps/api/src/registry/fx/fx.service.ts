import { BadRequestException, Injectable } from "@nestjs/common";
import { CbarRateStatus, Prisma } from "@erafinance/database";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

function bakuDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateParam(raw: string | undefined): Date {
  if (!raw) return new Date();
  const key = raw.slice(0, 10);
  const d = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ code: "INVALID_DATE", message: `Invalid date: ${raw}` });
  }
  return d;
}

@Injectable()
export class FxService {
  constructor(private readonly ds: DataSourceService) {}

  async getRates(dateRaw: string | undefined, symbolsRaw: string | undefined) {
    const rateDate = parseDateParam(dateRaw);
    const symbols = (symbolsRaw ?? "USD,EUR")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const db = this.ds.referenceDb();
    const rows = await db.cbarOfficialRate.findMany({
      where: {
        rateDate,
        currencyCode: { in: symbols },
        status: CbarRateStatus.FINAL,
      },
    });
    return {
      meta: registryMeta("cbar", bakuDateKey(rateDate)),
      rates: rows.map((r) => ({
        currencyCode: r.currencyCode,
        value: Number(r.value),
        nominal: r.nominal,
        rate: Number(r.rate),
        status: r.status,
        rateDate: bakuDateKey(r.rateDate),
      })),
    };
  }

  async getRatesRange(fromRaw: string, toRaw: string, symbol: string) {
    const from = parseDateParam(fromRaw);
    const to = parseDateParam(toRaw);
    const code = symbol.trim().toUpperCase();
    const db = this.ds.referenceDb();
    const rows = await db.cbarOfficialRate.findMany({
      where: {
        currencyCode: code,
        rateDate: { gte: from, lte: to },
        status: CbarRateStatus.FINAL,
      },
      orderBy: { rateDate: "asc" },
    });
    return {
      meta: registryMeta("cbar", `${bakuDateKey(from)}..${bakuDateKey(to)}`),
      symbol: code,
      points: rows.map((r) => ({
        rateDate: bakuDateKey(r.rateDate),
        rate: Number(r.rate),
        value: Number(r.value),
        nominal: r.nominal,
      })),
    };
  }

  async convert(
    from: string,
    to: string,
    amountRaw: string,
    dateRaw: string | undefined,
  ) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException({ code: "INVALID_AMOUNT", message: "amount must be a number" });
    }
    const asOf = parseDateParam(dateRaw);
    const fromU = from.trim().toUpperCase();
    const toU = to.trim().toUpperCase();
    const db = this.ds.referenceDb();

    const rateOn = async (code: string): Promise<number> => {
      if (code === "AZN" || code === "AZM") return 1;
      const row = await db.cbarOfficialRate.findUnique({
        where: {
          rateDate_currencyCode: { rateDate: asOf, currencyCode: code },
        },
      });
      if (!row || row.status !== CbarRateStatus.FINAL) {
        throw new BadRequestException({
          code: "RATE_NOT_FOUND",
          message: `No FINAL rate for ${code} on ${bakuDateKey(asOf)}`,
        });
      }
      return Number(row.rate);
    };

    const azn =
      fromU === "AZN" || fromU === "AZM" ? amount : amount * (await rateOn(fromU));
    const result =
      toU === "AZN" || toU === "AZM" ? azn : azn / (await rateOn(toU));

    return {
      meta: registryMeta("cbar", bakuDateKey(asOf)),
      from: fromU,
      to: toU,
      amount,
      result: Number(result.toFixed(8)),
    };
  }
}
