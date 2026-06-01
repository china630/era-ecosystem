import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class UomService {
  constructor(private readonly ds: DataSourceService) {}

  async list() {
    const db = this.ds.referenceDb();
    const rows = await db.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    let customsMapping: unknown = null;
    try {
      const root =
        process.env.DATA_HUB_FINANCE_CATALOG_ROOT?.trim() ||
        join(process.cwd(), "packages/database/catalog");
      const path = join(root, "trade/customs-law-uom-mapping.json");
      customsMapping = JSON.parse(await readFile(path, "utf-8"));
    } catch {
      /* optional in container — copy in Dockerfile later */
    }
    return {
      meta: registryMeta("units_of_measure", new Date().toISOString().slice(0, 10)),
      units: rows,
      customsLawMapping: customsMapping,
    };
  }
}
