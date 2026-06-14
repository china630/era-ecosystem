import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CounterpartyRole, Decimal } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import type {
  CreateSupplierRatingDto,
  UpdateSupplierRatingDto,
} from "./dto/supplier-rating.dto";
import type { CreateSupplierScorecardDto } from "./dto/create-supplier-scorecard.dto";
import type { UpdateSupplierScorecardDto } from "./dto/update-supplier-scorecard.dto";

@Injectable()
export class SupplierScorecardService {
  constructor(private readonly prisma: PrismaService) {}

  private scorecardInclude = {
    counterparty: { select: { id: true, nameCipher: true, role: true } },
    criteria: { orderBy: { sortOrder: "asc" as const } },
    ratings: {
      orderBy: { ratedAt: "desc" as const },
      include: {
        criterion: { select: { id: true, label: true } },
        ratedByUser: { select: { id: true, email: true } },
      },
    },
  };

  private async assertSupplier(organizationId: string, counterpartyId: string) {
    const cp = await this.prisma.counterparty.findFirst({
      where: {
        id: counterpartyId,
        organizationId,
        role: { in: [CounterpartyRole.SUPPLIER, CounterpartyRole.BOTH] },
      },
    });
    if (!cp) {
      throw new BadRequestException("Counterparty must be a supplier");
    }
    return cp;
  }

  async listScorecards(
    organizationId: string,
    opts?: { counterpartyId?: string; page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = {
      organizationId,
      ...(opts?.counterpartyId ? { counterpartyId: opts.counterpartyId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.supplierScorecard.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          counterparty: { select: { id: true, nameCipher: true } },
          _count: { select: { criteria: true, ratings: true } },
        },
      }),
      this.prisma.supplierScorecard.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getScorecard(organizationId: string, id: string) {
    const row = await this.prisma.supplierScorecard.findFirst({
      where: { id, organizationId },
      include: this.scorecardInclude,
    });
    if (!row) throw new NotFoundException("Supplier scorecard not found");
    return row;
  }

  async createScorecard(organizationId: string, dto: CreateSupplierScorecardDto) {
    await this.assertSupplier(organizationId, dto.counterpartyId);
    return this.prisma.supplierScorecard.create({
      data: {
        organizationId,
        counterpartyId: dto.counterpartyId,
        name: dto.name.trim(),
        periodLabel: dto.periodLabel?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        criteria: dto.criteria?.length
          ? {
              create: dto.criteria.map((c, index) => ({
                label: c.label.trim(),
                weight:
                  c.weight != null ? new Decimal(c.weight) : new Decimal(1),
                sortOrder: c.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: this.scorecardInclude,
    });
  }

  async updateScorecard(
    organizationId: string,
    id: string,
    dto: UpdateSupplierScorecardDto,
  ) {
    await this.getScorecard(organizationId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.criteria != null) {
        await tx.supplierRating.deleteMany({ where: { scorecardId: id } });
        await tx.supplierScorecardCriterion.deleteMany({
          where: { scorecardId: id },
        });
        if (dto.criteria.length) {
          await tx.supplierScorecardCriterion.createMany({
            data: dto.criteria.map((c, index) => ({
              scorecardId: id,
              label: c.label.trim(),
              weight:
                c.weight != null ? new Decimal(c.weight) : new Decimal(1),
              sortOrder: c.sortOrder ?? index,
            })),
          });
        }
      }

      return tx.supplierScorecard.update({
        where: { id },
        data: {
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.periodLabel !== undefined
            ? { periodLabel: dto.periodLabel?.trim() ?? null }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() ?? null }
            : {}),
        },
        include: this.scorecardInclude,
      });
    });
  }

  async deleteScorecard(organizationId: string, id: string) {
    await this.getScorecard(organizationId, id);
    await this.prisma.supplierScorecard.delete({ where: { id } });
    return { ok: true };
  }

  async listRatings(
    organizationId: string,
    opts?: { counterpartyId?: string; scorecardId?: string },
  ) {
    return this.prisma.supplierRating.findMany({
      where: {
        organizationId,
        ...(opts?.counterpartyId ? { counterpartyId: opts.counterpartyId } : {}),
        ...(opts?.scorecardId ? { scorecardId: opts.scorecardId } : {}),
      },
      orderBy: [{ ratedAt: "desc" }],
      include: {
        counterparty: { select: { id: true, nameCipher: true } },
        scorecard: { select: { id: true, name: true } },
        criterion: { select: { id: true, label: true } },
        ratedByUser: { select: { id: true, email: true } },
      },
    });
  }

  async createRating(
    organizationId: string,
    ratedByUserId: string,
    dto: CreateSupplierRatingDto,
  ) {
    const scorecard = await this.getScorecard(organizationId, dto.scorecardId);
    const criterion = scorecard.criteria.find((c) => c.id === dto.criterionId);
    if (!criterion) {
      throw new BadRequestException("Criterion does not belong to scorecard");
    }

    return this.prisma.supplierRating.create({
      data: {
        organizationId,
        counterpartyId: scorecard.counterpartyId,
        scorecardId: dto.scorecardId,
        criterionId: dto.criterionId,
        score: dto.score,
        periodLabel: dto.periodLabel?.trim() ?? scorecard.periodLabel ?? null,
        notes: dto.notes?.trim() ?? null,
        ratedByUserId,
      },
      include: {
        criterion: { select: { id: true, label: true } },
        ratedByUser: { select: { id: true, email: true } },
      },
    });
  }

  async updateRating(
    organizationId: string,
    id: string,
    dto: UpdateSupplierRatingDto,
  ) {
    const existing = await this.prisma.supplierRating.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Supplier rating not found");

    return this.prisma.supplierRating.update({
      where: { id },
      data: {
        ...(dto.score != null ? { score: dto.score } : {}),
        ...(dto.periodLabel !== undefined
          ? { periodLabel: dto.periodLabel?.trim() ?? null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
      },
      include: {
        criterion: { select: { id: true, label: true } },
        ratedByUser: { select: { id: true, email: true } },
      },
    });
  }

  async deleteRating(organizationId: string, id: string) {
    const existing = await this.prisma.supplierRating.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Supplier rating not found");
    await this.prisma.supplierRating.delete({ where: { id } });
    return { ok: true };
  }
}
