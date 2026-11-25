import { Injectable, NotFoundException } from "@nestjs/common";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

@Injectable()
export class ConstructionMaterialsService {
  constructor(private readonly ds: DataSourceService) {}

  async list(q?: string) {
    const db = this.ds.referenceDb();
    const query = q?.trim();
    const rows = await db.constructionMaterial.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { code: { contains: query, mode: "insensitive" } },
                { nameEn: { contains: query, mode: "insensitive" } },
                { nameRu: { contains: query, mode: "insensitive" } },
                { nameAz: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      take: 500,
    });
    return {
      meta: registryMeta("construction_materials", todayBakuYmd()),
      materials: rows,
    };
  }

  async getByCode(code: string) {
    const db = this.ds.referenceDb();
    const normalized = code.trim();
    const row = await db.constructionMaterial.findFirst({
      where: { code: normalized, isActive: true, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: "MATERIAL_NOT_FOUND",
        message: `Construction material not found: ${normalized}`,
      });
    }
    return {
      meta: registryMeta("construction_materials", todayBakuYmd()),
      material: row,
    };
  }
}
