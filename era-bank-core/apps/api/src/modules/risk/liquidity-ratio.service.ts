import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { computeLcrRatioStub } from "../treasury/liquidity-gap.engine";

/** Risk owns LCR/NSFR ratios; treasury keeps GAP snapshot production. */
@Injectable()
export class LiquidityRatioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  async latestGap(asOfDate?: Date) {
    return this.prisma.liquidityGapSnapshot.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(asOfDate ? { asOfDate } : {}),
      },
      orderBy: { asOfDate: "desc" },
    });
  }

  async lcr(asOfDate?: Date) {
    const snap = await this.latestGap(asOfDate);
    if (!snap) {
      return {
        lcrRatio: null,
        source: null,
        note: "No LiquidityGapSnapshot — run treasury gap first",
      };
    }
    const buckets = snap.bucketsJson as {
      lcrRatioStub?: number | null;
      liquidAssetsMinor?: string | number;
      netOutflows30dMinor?: string | number;
    };
    let lcrRatio = buckets.lcrRatioStub ?? null;
    if (
      lcrRatio == null &&
      buckets.liquidAssetsMinor != null &&
      buckets.netOutflows30dMinor != null
    ) {
      lcrRatio = computeLcrRatioStub(
        BigInt(buckets.liquidAssetsMinor),
        BigInt(buckets.netOutflows30dMinor),
      );
    }
    return {
      asOfDate: snap.asOfDate.toISOString().slice(0, 10),
      gapSnapshotId: snap.id,
      lcrRatio,
      source: "treasury.LiquidityGapSnapshot",
      owner: "banking_risk",
    };
  }

  /** NSFR MVP stub: available stable funding / required ≈ inverse of short-gap pressure. */
  async nsfr(asOfDate?: Date) {
    const lcr = await this.lcr(asOfDate);
    const nsfrRatio =
      lcr.lcrRatio != null ? Math.min(2, Math.max(0.5, lcr.lcrRatio * 0.95)) : null;
    return {
      ...lcr,
      nsfrRatio,
      note: "NSFR MVP derived from LCR stub — not CBAR-certified",
    };
  }
}
