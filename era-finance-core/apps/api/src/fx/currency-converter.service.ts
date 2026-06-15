import { Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { CbarRateSyncService } from "./cbar-rate-sync.service";

/**
 * Consolidates amounts to reporting currency via CBAR (era-data-hub when enabled).
 * Strict accounting path uses FINAL rates only (see CbarRateSyncService.getFinalOfficialAznPerUnit).
 */
@Injectable()
export class CurrencyConverterService {
  constructor(private readonly cbarSync: CbarRateSyncService) {}

  async convert(
    amount: Prisma.Decimal,
    fromCurrency: string,
    toCurrency: string,
    asOf: Date,
  ): Promise<Prisma.Decimal> {
    const from = fromCurrency.trim().toUpperCase();
    const to = toCurrency.trim().toUpperCase();
    if (from === to) return amount;
    const inAzn = await this.toAzn(amount, from, asOf);
    if (to === "AZN" || to === "AZM") return inAzn;
    const rateTo = await this.cbarSync.getFinalOfficialAznPerUnit(to, asOf);
    const aznPerUnit = new Prisma.Decimal(rateTo);
    if (aznPerUnit.lte(0)) {
      throw new Error(
        `CBAR invalid rate for ${to} as of ${asOf.toISOString().slice(0, 10)}: ${rateTo}`,
      );
    }
    return inAzn.div(aznPerUnit);
  }

  private async toAzn(
    amount: Prisma.Decimal,
    from: string,
    asOf: Date,
  ): Promise<Prisma.Decimal> {
    if (from === "AZN" || from === "AZM") return amount;
    const r = await this.cbarSync.getFinalOfficialAznPerUnit(from, asOf);
    return amount.mul(new Prisma.Decimal(r));
  }
}
