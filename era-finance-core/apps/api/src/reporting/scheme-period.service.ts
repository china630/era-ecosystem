import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal, TaxAmendmentDraftStatus } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import type { ApplySchemePeriodDto } from "./dto/scheme-period.dto";
import { amendmentBlocksClose, decideSchemeRecalc } from "./scheme-period-recalc";
import { SimplifiedTaxWatchService } from "./simplified-tax-watch.service";

@Injectable()
export class SchemePeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly watch?: SimplifiedTaxWatchService,
  ) {}

  async apply(organizationId: string, input: ApplySchemePeriodDto) {
    if (!this.watch) {
      throw new BadRequestException("The scheme watcher is not available");
    }
    const exportRow = await this.prisma.taxDeclarationExport.findFirst({
      where: {
        organizationId,
        period: input.period,
        taxType: input.taxType,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!exportRow || exportRow.amountAzn == null) {
      throw new BadRequestException("The export has no saved amount to compare");
    }
    const computed = await this.watch.recomputedAmount(organizationId, input.period, input.taxType);
    const decision = decideSchemeRecalc({
      status: exportRow.status,
      previousAmount: new Decimal(exportRow.amountAzn).toFixed(2),
      nextAmount: computed.amount,
      retroactive: computed.retroactive,
    });
    if (decision.kind === "recalculate" && exportRow) {
      await this.prisma.taxDeclarationExport.update({
        where: { id: exportRow.id },
        data: {
          previousAmountAzn: decision.previous,
          amountAzn: decision.next,
        },
      });
    }
    if (decision.kind === "amendment") {
      await this.prisma.taxAmendmentDraft.upsert({
        where: {
          organizationId_taxType_period: {
            organizationId,
            taxType: input.taxType,
            period: input.period,
          },
        },
        create: {
          organizationId,
          taxType: input.taxType,
          period: input.period,
          sourceExportId: exportRow?.id ?? null,
          previousAmount: decision.previous,
          revisedAmount: decision.next,
          deltaAmount: decision.delta,
          status: TaxAmendmentDraftStatus.DRAFT,
        },
        update: {
          previousAmount: decision.previous,
          revisedAmount: decision.next,
          deltaAmount: decision.delta,
          status: TaxAmendmentDraftStatus.DRAFT,
          sentAt: null,
          sourceExportId: exportRow?.id ?? null,
        },
      });
    }
    return { decision, exportAmountUnchanged: decision.kind !== "recalculate" };
  }

  async list(organizationId: string, period?: string) {
    return this.prisma.taxAmendmentDraft.findMany({
      where: { organizationId, ...(period ? { period } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markSent(organizationId: string, id: string) {
    const row = await this.prisma.taxAmendmentDraft.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Amendment draft not found");
    if (row.status === TaxAmendmentDraftStatus.SENT) {
      return row;
    }
    return this.prisma.taxAmendmentDraft.update({
      where: { id: row.id },
      data: { status: TaxAmendmentDraftStatus.SENT, sentAt: new Date() },
    });
  }

  async assertCloseAllowed(organizationId: string, closePeriod: string): Promise<void> {
    const drafts = await this.prisma.taxAmendmentDraft.findMany({
      where: { organizationId, status: TaxAmendmentDraftStatus.DRAFT },
      select: { status: true, period: true },
    });
    if (!amendmentBlocksClose(drafts, closePeriod)) return;
    throw new ConflictException({
      code: "TAX_AMENDMENT_UNSENT",
      message: "The next month stays open until the amendment draft is marked sent",
    });
  }
}
