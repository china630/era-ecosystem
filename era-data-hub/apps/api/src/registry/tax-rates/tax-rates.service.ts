import { BadRequestException, Injectable } from "@nestjs/common";
import type { TaxRateKind } from "@era/data-hub-database";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class TaxRatesService {
  constructor(private readonly ds: DataSourceService) {}

  async onDate(type: string | undefined, dateRaw: string | undefined) {
    const on = dateRaw
      ? new Date(`${dateRaw.slice(0, 10)}T12:00:00.000Z`)
      : new Date();
    if (Number.isNaN(on.getTime())) {
      throw new BadRequestException({ code: "INVALID_DATE", message: "Invalid date" });
    }
    const kind = type?.trim().toUpperCase() as TaxRateKind | undefined;
    const db = this.ds.referenceDb();
    const rows = await db.taxRate.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: on },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
        ...(kind ? { kind } : {}),
      },
      orderBy: { sortOrder: "asc" },
    });
    return {
      meta: registryMeta("tax_rates", on.toISOString().slice(0, 10)),
      rates: rows.map((r) => ({
        code: r.code,
        kind: r.kind,
        percent: Number(r.percent),
        effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: r.effectiveTo?.toISOString().slice(0, 10) ?? null,
        nameAz: r.nameAz,
        nameRu: r.nameRu,
        nameEn: r.nameEn,
      })),
    };
  }
}
