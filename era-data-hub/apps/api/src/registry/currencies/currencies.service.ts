import { Injectable } from "@nestjs/common";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class CurrenciesService {
  constructor(private readonly ds: DataSourceService) {}

  async list() {
    const db = this.ds.referenceDb();
    const rows = await db.currency.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        symbol: true,
        decimals: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
        isActive: true,
        sortOrder: true,
      },
    });
    return {
      meta: registryMeta("currencies", todayBakuYmd()),
      currencies: rows,
    };
  }
}
