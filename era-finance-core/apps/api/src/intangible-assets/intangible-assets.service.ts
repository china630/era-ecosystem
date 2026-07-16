import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetDepreciationMethod,
  FixedAssetStatus,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIntangibleAssetDto } from "./dto/create-intangible-asset.dto";

const Decimal = Prisma.Decimal;

@Injectable()
export class IntangibleAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.intangibleAsset.findMany({
      where: { organizationId },
      orderBy: [{ inventoryNumber: "asc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.intangibleAsset.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Intangible asset not found");
    return row;
  }

  async create(organizationId: string, dto: CreateIntangibleAssetDto) {
    const salvage = new Decimal(dto.salvageValue ?? 0);
    const initial = new Decimal(dto.purchasePrice);
    if (salvage.gte(initial)) {
      throw new ConflictException("salvageValue must be less than purchasePrice");
    }
    try {
      return await this.prisma.intangibleAsset.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          inventoryNumber: dto.inventoryNumber.trim(),
          purchaseDate: new Date(dto.purchaseDate),
          purchasePrice: initial,
          usefulLifeMonths: dto.usefulLifeMonths,
          salvageValue: salvage,
          status: dto.status ?? FixedAssetStatus.ACTIVE,
          depreciationMethod:
            dto.depreciationMethod ?? FixedAssetDepreciationMethod.STRAIGHT_LINE,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Inventory number already in use");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    try {
      await this.prisma.intangibleAsset.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ConflictException("Cannot delete: amortization months exist");
      }
      throw e;
    }
  }
}
