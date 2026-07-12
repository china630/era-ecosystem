import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import type { CustomsDeclarationItemPrefill } from "@erafinance/api-contracts";
import { DataHubClientService } from "../data-hub/data-hub-client.service";

export type ComputedLine = {
  sequenceNumber: number;
  dutyRatePercent: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  excisePercent: Prisma.Decimal;
  calculatedDutyAzn: Prisma.Decimal;
  calculatedExciseAzn: Prisma.Decimal;
  calculatedVatAzn: Prisma.Decimal;
};

/**
 * Customs tax stack using era-data-hub tariffs only (Phase 2 — no local CustomsTariffRate).
 */
@Injectable()
export class CustomsTaxCalculatorService {
  constructor(private readonly dataHub: DataHubClientService) {}

  /**
   * GATT-style simplified stack: duty and excise on statistical value; VAT on (value + duty + excise).
   */
  async computeLines(
    items: CustomsDeclarationItemPrefill[],
    bgdDate: Date,
  ): Promise<{
    lines: ComputedLine[];
    totalDuty: Prisma.Decimal;
    totalVat: Prisma.Decimal;
    totalExcise: Prisma.Decimal;
  }> {
    if (!this.dataHub.isEnabled()) {
      throw new BadRequestException(
        "ERA_DATA_HUB_ENABLED=false — customs tariffs require era-data-hub",
      );
    }

    const lines: ComputedLine[] = [];
    let totalDuty = new Prisma.Decimal(0);
    let totalVat = new Prisma.Decimal(0);
    let totalExcise = new Prisma.Decimal(0);
    const dateKey = this.dataHub.isoDateBaku(bgdDate);

    for (const it of items) {
      const remote = await this.dataHub.getTariff(it.hsCode, dateKey);
      if (!remote) {
        // Optional meta for clearer errors
        const meta = await this.dataHub.getHsMeta(it.hsCode);
        throw new BadRequestException(
          meta?.hsCode
            ? `No tariff for HS ${meta.hsCode} on ${dateKey} (data-hub)`
            : `No tariff for HS ${it.hsCode} on ${dateKey} (data-hub)`,
        );
      }

      const dutyRate = new Prisma.Decimal(remote.dutyRatePercent);
      const vatRate = new Prisma.Decimal(remote.vatRatePercent);
      const exciseRate = new Prisma.Decimal(remote.excisePercent);

      const dutyBase = new Prisma.Decimal(it.statisticalValueAzn);
      const duty = dutyBase.mul(dutyRate).div(new Prisma.Decimal(100));
      const excise = dutyBase.mul(exciseRate).div(new Prisma.Decimal(100));
      const vatBase = dutyBase.add(duty).add(excise);
      const vat = vatBase.mul(vatRate).div(new Prisma.Decimal(100));

      lines.push({
        sequenceNumber: it.sequenceNumber,
        dutyRatePercent: dutyRate,
        vatRatePercent: vatRate,
        excisePercent: exciseRate,
        calculatedDutyAzn: duty,
        calculatedExciseAzn: excise,
        calculatedVatAzn: vat,
      });
      totalDuty = totalDuty.add(duty);
      totalVat = totalVat.add(vat);
      totalExcise = totalExcise.add(excise);
    }

    return { lines, totalDuty, totalVat, totalExcise };
  }
}
