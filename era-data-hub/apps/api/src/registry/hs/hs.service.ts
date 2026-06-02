import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

function parseDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const d = new Date(`${raw.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ code: "INVALID_DATE", message: `Invalid date: ${raw}` });
  }
  return d;
}

@Injectable()
export class HsService {
  constructor(private readonly ds: DataSourceService) {}

  async getHs(code: string) {
    const hs = code.replace(/\D/g, "").trim();
    const db = this.ds.referenceDb();
    const latest = await db.customsTariffRate.findFirst({
      where: { hsCode: { startsWith: hs }, deletedAt: null },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!latest) {
      throw new NotFoundException({ code: "HS_NOT_FOUND", message: `HS ${hs} not found` });
    }
    return {
      meta: registryMeta("customs_tariff_rates", latest.effectiveFrom.toISOString().slice(0, 10)),
      hsCode: latest.hsCode,
      description: latest.description,
    };
  }

  async getTariff(code: string, dateRaw?: string) {
    const hs = code.replace(/\D/g, "").trim();
    const on = parseDate(dateRaw);
    const db = this.ds.referenceDb();
    const row = await db.customsTariffRate.findFirst({
      where: {
        hsCode: { startsWith: hs },
        deletedAt: null,
        effectiveFrom: { lte: on },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!row) {
      throw new NotFoundException({
        code: "TARIFF_NOT_FOUND",
        message: `No tariff for HS ${hs} on ${on.toISOString().slice(0, 10)}`,
      });
    }
    return {
      meta: registryMeta("customs_tariff_rates", on.toISOString().slice(0, 10)),
      hsCode: row.hsCode,
      description: row.description,
      dutyRatePercent: Number(row.dutyRatePercent),
      vatRatePercent: Number(row.vatRatePercent),
      excisePercent: Number(row.excisePercent),
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
    };
  }
}
