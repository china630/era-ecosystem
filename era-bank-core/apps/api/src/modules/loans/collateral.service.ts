import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import {
  collateralEntitySnapshot,
  validateCollateralSharePct,
} from "./collateral-link.util";

export type AttachCollateralInput = {
  collateralItemId: string;
  sharePct: number;
};

export type CreateCollateralItemInput = {
  ownerId: string;
  type: string;
  valuationMinor: bigint;
  haircutPct?: number;
  registry: string;
  encumbranceRef?: string;
  insuredUntil?: Date;
  currency?: string;
  description?: string;
};

@Injectable()
export class CollateralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  async createItem(input: CreateCollateralItemInput) {
    return this.prisma.collateralItem.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        ownerId: input.ownerId,
        type: input.type,
        valuationMinor: input.valuationMinor,
        haircutPct: input.haircutPct ?? 0,
        registry: input.registry,
        encumbranceRef: input.encumbranceRef ?? null,
        insuredUntil: input.insuredUntil ?? null,
        currency: input.currency ?? "AZN",
        description: input.description ?? null,
      },
    });
  }

  /**
   * Attach a collateral entity to a loan (M2M). Keeps `collateralRef` JSON as a
   * human-readable snapshot for legacy consumers — gradual deprecation (P1-9).
   */
  async attachToLoan(loanId: string, input: AttachCollateralInput) {
    validateCollateralSharePct(input.sharePct);
    const loan = await this.prisma.loanContract.findFirst({
      where: { id: loanId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    const item = await this.prisma.collateralItem.findFirst({
      where: { id: input.collateralItemId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!item) throw new NotFoundException("Collateral item not found");

    const sharePct = new Prisma.Decimal(input.sharePct);

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.loanCollateralLink.upsert({
        where: {
          loanId_collateralItemId: {
            loanId,
            collateralItemId: input.collateralItemId,
          },
        },
        create: {
          bankOrgId: this.bankOrg.bankOrgId,
          loanId,
          collateralItemId: input.collateralItemId,
          sharePct,
        },
        update: { sharePct },
        include: { collateralItem: true },
      });

      const snapshot = collateralEntitySnapshot(item);
      await tx.loanContract.update({
        where: { id: loanId },
        data: { collateralRef: snapshot },
      });

      return link;
    });
  }

  listForLoan(loanId: string) {
    return this.prisma.loanCollateralLink.findMany({
      where: { loanId, bankOrgId: this.bankOrg.bankOrgId },
      include: { collateralItem: true },
      orderBy: { createdAt: "asc" },
    });
  }

  listItems() {
    return this.prisma.collateralItem.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Revalue collateral; marks stale when valuation older than maxAgeDays
   * (uses updatedAt as valuation timestamp — no separate valuationDate column).
   */
  async revalueItem(
    id: string,
    valuationMinor: bigint,
    haircutPct?: number,
  ) {
    const item = await this.prisma.collateralItem.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!item) throw new NotFoundException("Collateral item not found");
    return this.prisma.collateralItem.update({
      where: { id },
      data: {
        valuationMinor,
        ...(haircutPct != null ? { haircutPct } : {}),
      },
    });
  }

  async listWithStaleFlags(maxAgeDays = 365) {
    const items = await this.listItems();
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    return items.map((item) => ({
      ...item,
      valuationMinor: item.valuationMinor.toString(),
      haircutPct: item.haircutPct.toString(),
      staleRevaluation: item.updatedAt.getTime() < cutoff,
      valuationAsOf: item.updatedAt.toISOString(),
    }));
  }
}