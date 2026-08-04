import { Injectable } from "@nestjs/common";
import { CashOrderSubtypeDirection } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_PKO_SUBTYPES,
  DEFAULT_RKO_SUBTYPES,
} from "./cash-order-subtype-codes";

@Injectable()
export class CashOrderSubtypesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(organizationId: string) {
    for (const row of DEFAULT_PKO_SUBTYPES) {
      await this.prisma.cashOrderSubtype.upsert({
        where: {
          organizationId_direction_code: {
            organizationId,
            direction: CashOrderSubtypeDirection.PKO,
            code: row.code,
          },
        },
        create: {
          organizationId,
          direction: CashOrderSubtypeDirection.PKO,
          code: row.code,
          nameAz: row.nameAz,
          nameRu: row.nameRu,
          nameEn: row.nameEn,
          sortOrder: row.sortOrder,
          systemKey: row.code,
          active: true,
        },
        update: {
          nameAz: row.nameAz,
          nameRu: row.nameRu,
          nameEn: row.nameEn,
          sortOrder: row.sortOrder,
        },
      });
    }
    for (const row of DEFAULT_RKO_SUBTYPES) {
      await this.prisma.cashOrderSubtype.upsert({
        where: {
          organizationId_direction_code: {
            organizationId,
            direction: CashOrderSubtypeDirection.RKO,
            code: row.code,
          },
        },
        create: {
          organizationId,
          direction: CashOrderSubtypeDirection.RKO,
          code: row.code,
          nameAz: row.nameAz,
          nameRu: row.nameRu,
          nameEn: row.nameEn,
          sortOrder: row.sortOrder,
          systemKey: row.code,
          active: true,
        },
        update: {
          nameAz: row.nameAz,
          nameRu: row.nameRu,
          nameEn: row.nameEn,
          sortOrder: row.sortOrder,
        },
      });
    }
  }

  async list(
    organizationId: string,
    direction?: CashOrderSubtypeDirection,
    activeOnly = true,
  ) {
    await this.ensureDefaults(organizationId);
    return this.prisma.cashOrderSubtype.findMany({
      where: {
        organizationId,
        ...(direction ? { direction } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: [{ direction: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
  }

  async create(
    organizationId: string,
    data: {
      direction: CashOrderSubtypeDirection;
      code: string;
      nameAz: string;
      nameRu: string;
      nameEn: string;
      sortOrder?: number;
    },
  ) {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, "_");
    return this.prisma.cashOrderSubtype.create({
      data: {
        organizationId,
        direction: data.direction,
        code,
        nameAz: data.nameAz.trim(),
        nameRu: data.nameRu.trim(),
        nameEn: data.nameEn.trim(),
        sortOrder: data.sortOrder ?? 100,
        active: true,
      },
    });
  }
}
