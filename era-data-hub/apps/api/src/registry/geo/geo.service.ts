import { Injectable } from "@nestjs/common";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class GeoService {
  constructor(private readonly ds: DataSourceService) {}

  async countries() {
    const db = this.ds.referenceDb();
    const rows = await db.country.findMany({ orderBy: { sortOrder: "asc" } });
    return { meta: registryMeta("countries", todayBakuYmd()), countries: rows };
  }

  async cities(countryIso2?: string) {
    const db = this.ds.referenceDb();
    const where = countryIso2 ? { countryIso2: countryIso2.trim().toUpperCase() } : {};
    const rows = await db.city.findMany({ where, orderBy: { sortOrder: "asc" } });
    return { meta: registryMeta("cities", todayBakuYmd()), cities: rows };
  }
}
