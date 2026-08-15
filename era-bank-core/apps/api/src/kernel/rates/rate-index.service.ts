import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class RateIndexService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  async getQuote(indexKey: string, asOfDate: Date = new Date()) {
    const day = new Date(asOfDate.toISOString().slice(0, 10));
    const exact = await this.prisma.rateIndexQuote.findUnique({
      where: {
        bankOrgId_indexKey_asOfDate: {
          bankOrgId: this.bankOrg.bankOrgId,
          indexKey,
          asOfDate: day,
        },
      },
    });
    if (exact) return exact;

    const latest = await this.prisma.rateIndexQuote.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        indexKey,
        asOfDate: { lte: day },
      },
      orderBy: { asOfDate: "desc" },
    });
    if (!latest) {
      throw new NotFoundException(
        `No RateIndexQuote for ${indexKey} on/before ${day.toISOString().slice(0, 10)}`,
      );
    }
    return latest;
  }

  /** effective = index + spreadBps/10000, optional floor. */
  async resolveEffectiveRate(input: {
    indexKey: string;
    spreadBps?: number | null;
    rateFloor?: number | null;
    asOfDate?: Date;
  }): Promise<number> {
    const quote = await this.getQuote(input.indexKey, input.asOfDate ?? new Date());
    let rate = Number(quote.rateAnnual) + (input.spreadBps ?? 0) / 10_000;
    if (input.rateFloor != null && rate < input.rateFloor) {
      rate = input.rateFloor;
    }
    return rate;
  }
}
