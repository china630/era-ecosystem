import { BadRequestException, Injectable } from "@nestjs/common";
import {
  FixedAssetStatus,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { yearRangeUtc } from "./reporting-period.util";

const Decimal = Prisma.Decimal;

/**
 * Placeholder annual property tax rate (0.1% of net book value).
 * Override via Organization.settings.tax.propertyTaxRatePercent (percent points, e.g. 0.1).
 */
export const DEFAULT_PROPERTY_TAX_RATE_PERCENT = 0.1;

@Injectable()
export class PropertyTaxService {
  constructor(private readonly prisma: PrismaService) {}

  async aggregatePropertyTax(organizationId: string, year: number) {
    this.assertYear(year);
    const { fromStr, toStr } = yearRangeUtc(year);

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        organizationId,
        status: FixedAssetStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        inventoryNumber: true,
        purchasePrice: true,
        bookedDepreciation: true,
      },
    });

    const lines = assets.map((a) => {
      const netBook = a.purchasePrice.sub(a.bookedDepreciation);
      return {
        fixedAssetId: a.id,
        name: a.name,
        inventoryNumber: a.inventoryNumber,
        purchasePrice: a.purchasePrice.toFixed(4),
        bookedDepreciation: a.bookedDepreciation.toFixed(4),
        netBookValue: netBook.toFixed(4),
      };
    });

    const netBookTotal = assets.reduce(
      (sum, a) => sum.add(a.purchasePrice.sub(a.bookedDepreciation)),
      new Decimal(0),
    );

    const ratePercent = await this.resolveRatePercent(organizationId);
    const taxAmount = netBookTotal.mul(ratePercent).div(100);

    return {
      year,
      periodFrom: fromStr,
      periodTo: toStr,
      ratePercent: ratePercent.toFixed(4),
      rateNote:
        "Placeholder 0.1% of ACTIVE fixed-asset net book (purchasePrice − bookedDepreciation). Override via settings.tax.propertyTaxRatePercent.",
      assetCount: assets.length,
      netBookTotal: netBookTotal.toFixed(4),
      taxAmount: taxAmount.toFixed(4),
      lines,
    };
  }

  private async resolveRatePercent(
    organizationId: string,
  ): Promise<InstanceType<typeof Decimal>> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings =
      org?.settings && typeof org.settings === "object"
        ? (org.settings as Record<string, unknown>)
        : {};
    const tax =
      settings.tax && typeof settings.tax === "object"
        ? (settings.tax as Record<string, unknown>)
        : {};
    const raw = tax.propertyTaxRatePercent;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      return new Decimal(raw);
    }
    if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) {
      return new Decimal(raw);
    }
    return new Decimal(DEFAULT_PROPERTY_TAX_RATE_PERCENT);
  }

  private assertYear(year: number) {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Invalid year (expected 2000–2100)");
    }
  }
}
