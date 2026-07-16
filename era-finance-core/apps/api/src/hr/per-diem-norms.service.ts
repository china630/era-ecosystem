import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PerDiemNormsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.perDiemNorm.findMany({
      where: { organizationId },
      orderBy: { regionCode: "asc" },
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.perDiemNorm.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Per diem norm not found");
    return row;
  }

  async create(
    organizationId: string,
    dto: {
      regionCode: string;
      regionName: string;
      dailyAznDomestic: number;
      foreignFactor?: number;
    },
  ) {
    const regionCode = dto.regionCode.trim();
    const regionName = dto.regionName.trim();
    if (!regionCode || !regionName) {
      throw new BadRequestException("regionCode and regionName are required");
    }
    try {
      return await this.prisma.perDiemNorm.create({
        data: {
          organizationId,
          regionCode,
          regionName,
          dailyAznDomestic: new Decimal(dto.dailyAznDomestic),
          foreignFactor: new Decimal(dto.foreignFactor ?? 1),
        },
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Region code already exists");
      }
      throw e;
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: {
      regionCode?: string;
      regionName?: string;
      dailyAznDomestic?: number;
      foreignFactor?: number;
    },
  ) {
    await this.getOne(organizationId, id);
    try {
      return await this.prisma.perDiemNorm.update({
        where: { id },
        data: {
          ...(dto.regionCode != null
            ? { regionCode: dto.regionCode.trim() }
            : {}),
          ...(dto.regionName != null
            ? { regionName: dto.regionName.trim() }
            : {}),
          ...(dto.dailyAznDomestic != null
            ? { dailyAznDomestic: new Decimal(dto.dailyAznDomestic) }
            : {}),
          ...(dto.foreignFactor != null
            ? { foreignFactor: new Decimal(dto.foreignFactor) }
            : {}),
        },
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Region code already exists");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    await this.prisma.perDiemNorm.delete({ where: { id } });
    return { ok: true };
  }
}
