import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountingBookStatus,
  Decimal,
  LedgerMappingSetStatus,
  LedgerType,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { LEDGER_MAPPING_CODE_NAS_TO_IFRS } from "./ledger-mapping.constants";

type AccountsDb = PrismaService | Prisma.TransactionClient;

export type LedgerMappingCoverage = {
  nasAccountCount: number;
  mappedNasCount: number;
  coveragePct: number;
  unmappedNasAccountIds: string[];
  typeMismatchCount: number;
  missingTargetCount: number;
  duplicateSourceCount: number;
};

@Injectable()
export class LedgerMappingService {
  constructor(private readonly prisma: PrismaService) {}

  listSets(organizationId: string) {
    return this.prisma.ledgerMappingSet.findMany({
      where: { organizationId },
      include: {
        fromBook: true,
        toBook: true,
        _count: { select: { lines: true } },
      },
      orderBy: [{ version: "desc" }],
    });
  }

  async getSet(organizationId: string, id: string) {
    const row = await this.prisma.ledgerMappingSet.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: {
            sourceAccount: {
              select: {
                id: true,
                code: true,
                type: true,
                nameAz: true,
                nameRu: true,
                nameEn: true,
                ledgerType: true,
                deletedAt: true,
              },
            },
            targetAccount: {
              select: {
                id: true,
                code: true,
                type: true,
                nameAz: true,
                nameRu: true,
                nameEn: true,
                ledgerType: true,
                deletedAt: true,
              },
            },
          },
          orderBy: [{ sourceAccount: { code: "asc" } }, { sortOrder: "asc" }],
        },
      },
    });
    if (!row) throw new NotFoundException("Mapping set not found");
    const coverage = await this.computeCoverageForLines(
      organizationId,
      row.fromBookId,
      row.lines.map((l) => ({
        sourceAccountId: l.sourceAccountId,
        targetAccountId: l.targetAccountId,
        sourceType: l.sourceAccount.type,
        targetType: l.targetAccount.type,
        targetDeletedAt: l.targetAccount.deletedAt,
        sortOrder: l.sortOrder,
      })),
    );
    return { ...row, coverage };
  }

  async ensureDraftSet(
    organizationId: string,
    db: AccountsDb = this.prisma,
  ): Promise<{ id: string; version: number }> {
    const existingDraft = await db.ledgerMappingSet.findFirst({
      where: {
        organizationId,
        code: LEDGER_MAPPING_CODE_NAS_TO_IFRS,
        status: LedgerMappingSetStatus.DRAFT,
      },
      orderBy: { version: "desc" },
    });
    if (existingDraft) {
      return { id: existingDraft.id, version: existingDraft.version };
    }

    const max = await db.ledgerMappingSet.findFirst({
      where: { organizationId, code: LEDGER_MAPPING_CODE_NAS_TO_IFRS },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (max?.version ?? 0) + 1;
    const created = await db.ledgerMappingSet.create({
      data: {
        organizationId,
        code: LEDGER_MAPPING_CODE_NAS_TO_IFRS,
        version,
        status: LedgerMappingSetStatus.DRAFT,
      },
    });
    return { id: created.id, version: created.version };
  }

  /**
   * Onboarding: seed mapping lines and auto-publish when no PUBLISHED set exists
   * (greenfield demo SSOT). Later expands stay DRAFT until accountant publishes.
   */
  async bootstrapDraftFromAccountPairs(
    organizationId: string,
    pairs: Array<{
      sourceAccountId: string;
      targetAccountId: string;
      ratio?: Decimal;
    }>,
    db: AccountsDb = this.prisma,
  ): Promise<void> {
    if (pairs.length === 0) return;

    const published = await db.ledgerMappingSet.findFirst({
      where: {
        organizationId,
        code: LEDGER_MAPPING_CODE_NAS_TO_IFRS,
        status: LedgerMappingSetStatus.PUBLISHED,
      },
      select: { id: true },
    });

    const draft = await this.ensureDraftSet(organizationId, db);
    for (const p of pairs) {
      const exists = await db.ledgerMappingLine.findFirst({
        where: {
          mappingSetId: draft.id,
          sourceAccountId: p.sourceAccountId,
          sortOrder: 0,
        },
      });
      if (exists) continue;
      await db.ledgerMappingLine.create({
        data: {
          mappingSetId: draft.id,
          sourceAccountId: p.sourceAccountId,
          targetAccountId: p.targetAccountId,
          ratio: p.ratio ?? new Decimal(1),
          sortOrder: 0,
        },
      });
    }

    if (!published) {
      await db.ledgerMappingSet.update({
        where: { id: draft.id },
        data: {
          status: LedgerMappingSetStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
    }
  }

  async replaceDraftLines(
    organizationId: string,
    setId: string,
    lines: Array<{
      sourceAccountId: string;
      targetAccountId: string;
      ratio?: string | number;
      sortOrder?: number;
    }>,
  ) {
    const set = await this.prisma.ledgerMappingSet.findFirst({
      where: { id: setId, organizationId },
    });
    if (!set) throw new NotFoundException("Mapping set not found");
    if (set.status !== LedgerMappingSetStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT sets can be edited");
    }
    if (!set.fromBookId || !set.toBookId) {
      throw new BadRequestException({
        code: "MAPPING_BOOK_PAIR_REQUIRED",
        message: "fromBookId and toBookId are required",
      });
    }
    await this.assertActiveBookPair(
      organizationId,
      set.fromBookId,
      set.toBookId,
    );

    this.assertOneToOneSources(lines);

    const sourceIds = [...new Set(lines.map((l) => l.sourceAccountId))];
    const targetIds = [...new Set(lines.map((l) => l.targetAccountId))];
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        id: { in: [...sourceIds, ...targetIds] },
      },
      select: {
        id: true,
        accountingBookId: true,
        type: true,
        deletedAt: true,
      },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));

    for (const line of lines) {
      const src = byId.get(line.sourceAccountId);
      const tgt = byId.get(line.targetAccountId);
      if (!src || src.accountingBookId !== set.fromBookId || src.deletedAt) {
        throw new BadRequestException(
          `sourceAccountId must be an active account in fromBookId: ${line.sourceAccountId}`,
        );
      }
      if (!tgt || tgt.accountingBookId !== set.toBookId || tgt.deletedAt) {
        throw new BadRequestException(
          `targetAccountId must be an active account in toBookId: ${line.targetAccountId}`,
        );
      }
      if (src.type !== tgt.type) {
        throw new BadRequestException(
          `Account type mismatch: ${line.sourceAccountId} vs ${line.targetAccountId}`,
        );
      }
      const ratio = new Decimal(line.ratio ?? 1);
      if (ratio.lte(0)) {
        throw new BadRequestException("ratio must be positive");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerMappingLine.deleteMany({ where: { mappingSetId: setId } });
      if (lines.length === 0) return;
      await tx.ledgerMappingLine.createMany({
        data: lines.map((l) => ({
          mappingSetId: setId,
          sourceAccountId: l.sourceAccountId,
          targetAccountId: l.targetAccountId,
          ratio: new Decimal(l.ratio ?? 1),
          sortOrder: 0,
        })),
      });
    });

    return this.getSet(organizationId, setId);
  }

  async publish(
    organizationId: string,
    setId: string,
    publishedByUserId?: string | null,
  ) {
    const set = await this.prisma.ledgerMappingSet.findFirst({
      where: { id: setId, organizationId },
      include: {
        lines: {
          include: {
            sourceAccount: {
              select: {
                id: true,
                accountingBookId: true,
                type: true,
                deletedAt: true,
              },
            },
            targetAccount: {
              select: {
                id: true,
                accountingBookId: true,
                type: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
    if (!set) throw new NotFoundException("Mapping set not found");
    if (set.status !== LedgerMappingSetStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT sets can be published");
    }
    if (!set.fromBookId || !set.toBookId) {
      throw new BadRequestException({
        code: "MAPPING_BOOK_PAIR_REQUIRED",
        message: "fromBookId and toBookId are required",
      });
    }
    await this.assertActiveBookPair(
      organizationId,
      set.fromBookId,
      set.toBookId,
    );
    if (set.lines.length === 0) {
      throw new BadRequestException("Cannot publish an empty mapping set");
    }
    for (const line of set.lines) {
      if (
        line.sourceAccount.deletedAt ||
        line.sourceAccount.accountingBookId !== set.fromBookId
      ) {
        throw new BadRequestException({
          code: "MAPPING_SOURCE_BOOK_MISMATCH",
          message: "Every source account must belong to fromBookId",
        });
      }
      if (
        line.targetAccount.deletedAt ||
        line.targetAccount.accountingBookId !== set.toBookId
      ) {
        throw new BadRequestException({
          code: "MAPPING_TARGET_BOOK_MISMATCH",
          message: "Every target account must belong to toBookId",
        });
      }
    }

    this.assertOneToOneSources(set.lines);

    const coverage = await this.computeCoverageForLines(
      organizationId,
      set.fromBookId,
      set.lines.map((l) => ({
        sourceAccountId: l.sourceAccountId,
        targetAccountId: l.targetAccountId,
        sourceType: l.sourceAccount.type,
        targetType: l.targetAccount.type,
        targetDeletedAt: l.targetAccount.deletedAt,
        sortOrder: l.sortOrder,
      })),
    );

    if (coverage.duplicateSourceCount > 0) {
      throw new BadRequestException({
        code: "MAPPING_DUPLICATE_SOURCE",
        message: "A mapping set requires one line per source account",
        coverage,
      });
    }
    if (coverage.missingTargetCount > 0 || coverage.typeMismatchCount > 0) {
      throw new BadRequestException({
        code: "MAPPING_PUBLISH_INVALID_LINES",
        message:
          "Fix type mismatches and missing/deleted targets before publish",
        coverage,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerMappingSet.updateMany({
        where: {
          organizationId,
          code: set.code,
          status: LedgerMappingSetStatus.PUBLISHED,
        },
        data: { status: LedgerMappingSetStatus.ARCHIVED },
      });
      await tx.ledgerMappingSet.update({
        where: { id: setId },
        data: {
          status: LedgerMappingSetStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedByUserId: publishedByUserId ?? null,
        },
      });
    });

    return this.getSet(organizationId, setId);
  }

  async coverage(organizationId: string, setId?: string) {
    let lines: Array<{
      sourceAccountId: string;
      targetAccountId: string;
      sourceType: string;
      targetType: string;
      targetDeletedAt: Date | null;
      sortOrder: number;
    }> = [];
    let fromBookId: string | null = null;

    if (setId) {
      const set = await this.prisma.ledgerMappingSet.findFirst({
        where: { id: setId, organizationId },
        include: {
          lines: {
            include: {
              sourceAccount: { select: { type: true } },
              targetAccount: { select: { type: true, deletedAt: true } },
            },
          },
        },
      });
      if (!set) throw new NotFoundException("Mapping set not found");
      fromBookId = set.fromBookId;
      lines = set.lines.map((l) => ({
        sourceAccountId: l.sourceAccountId,
        targetAccountId: l.targetAccountId,
        sourceType: l.sourceAccount.type,
        targetType: l.targetAccount.type,
        targetDeletedAt: l.targetAccount.deletedAt,
        sortOrder: l.sortOrder,
      }));
    } else {
      const published = await this.prisma.ledgerMappingSet.findFirst({
        where: {
          organizationId,
          code: LEDGER_MAPPING_CODE_NAS_TO_IFRS,
          status: LedgerMappingSetStatus.PUBLISHED,
        },
        include: {
          lines: {
            include: {
              sourceAccount: { select: { type: true } },
              targetAccount: { select: { type: true, deletedAt: true } },
            },
          },
        },
      });
      if (published) {
        fromBookId = published.fromBookId;
        lines = published.lines.map((l) => ({
          sourceAccountId: l.sourceAccountId,
          targetAccountId: l.targetAccountId,
          sourceType: l.sourceAccount.type,
          targetType: l.targetAccount.type,
          targetDeletedAt: l.targetAccount.deletedAt,
          sortOrder: l.sortOrder,
        }));
      }
    }

    return this.computeCoverageForLines(organizationId, fromBookId, lines);
  }

  async createDraftForPair(
    organizationId: string,
    fromBookId: string,
    toBookId: string,
    requestedCode?: string,
  ) {
    const { fromBook, toBook } = await this.assertActiveBookPair(
      organizationId,
      fromBookId,
      toBookId,
    );
    const code =
      requestedCode?.trim().toUpperCase() ||
      (fromBook.code === "NAS" && toBook.code === "IFRS"
        ? LEDGER_MAPPING_CODE_NAS_TO_IFRS
        : `${fromBook.code}_TO_${toBook.code}`);
    const conflictingPair = await this.prisma.ledgerMappingSet.findFirst({
      where: {
        organizationId,
        code,
        OR: [
          { fromBookId: { not: fromBookId } },
          { toBookId: { not: toBookId } },
        ],
      },
      select: { id: true },
    });
    if (conflictingPair) {
      throw new BadRequestException({
        code: "MAPPING_CODE_PAIR_CONFLICT",
        message: "Mapping code is already used by a different book pair",
      });
    }
    const existing = await this.prisma.ledgerMappingSet.findFirst({
      where: {
        organizationId,
        code,
        fromBookId,
        toBookId,
        status: LedgerMappingSetStatus.DRAFT,
      },
      orderBy: { version: "desc" },
    });
    if (existing) return this.getSet(organizationId, existing.id);

    const latest = await this.prisma.ledgerMappingSet.findFirst({
      where: { organizationId, code },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const created = await this.prisma.ledgerMappingSet.create({
      data: {
        organizationId,
        code,
        version: (latest?.version ?? 0) + 1,
        status: LedgerMappingSetStatus.DRAFT,
        fromBookId,
        toBookId,
      },
    });
    return this.getSet(organizationId, created.id);
  }

  async createNewDraftFromPublished(organizationId: string) {
    const published = await this.prisma.ledgerMappingSet.findFirst({
      where: {
        organizationId,
        code: LEDGER_MAPPING_CODE_NAS_TO_IFRS,
        status: LedgerMappingSetStatus.PUBLISHED,
      },
      include: { lines: true },
    });
    const draft = await this.ensureDraftSet(organizationId);
    if (published && published.lines.length > 0) {
      const existing = await this.prisma.ledgerMappingLine.count({
        where: { mappingSetId: draft.id },
      });
      if (existing === 0) {
        await this.prisma.ledgerMappingLine.createMany({
          data: published.lines.map((l) => ({
            mappingSetId: draft.id,
            sourceAccountId: l.sourceAccountId,
            targetAccountId: l.targetAccountId,
            ratio: l.ratio,
            sortOrder: 0,
          })),
        });
      }
    }
    return this.getSet(organizationId, draft.id);
  }

  listFailedMirrors(organizationId: string, take = 100) {
    return this.prisma.transaction.findMany({
      where: {
        organizationId,
        mirrorStatus: "FAILED",
      },
      select: {
        id: true,
        date: true,
        reference: true,
        description: true,
        mirrorErrorCode: true,
        mirrorErrorDetail: true,
        mirrorMappingSetId: true,
        createdAt: true,
      },
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  /** Legacy writers — closed at service layer (HTTP already 410). */
  legacyMappingGone(): never {
    throw new GoneException({
      code: "LEGACY_MAPPING_GONE",
      message:
        "Legacy AccountMapping / IfrsMappingRule writes are closed. Use LedgerMappingSet APIs.",
    });
  }

  private assertOneToOneSources(
    lines: Array<{ sourceAccountId: string; sortOrder?: number }>,
  ): void {
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.sourceAccountId)) {
        throw new BadRequestException({
          code: "MAPPING_DUPLICATE_SOURCE",
          message: "A mapping set requires one line per source account",
        });
      }
      seen.add(l.sourceAccountId);
      if ((l.sortOrder ?? 0) !== 0) {
        throw new BadRequestException({
          code: "MAPPING_SORT_ORDER_RESERVED",
          message: "P0 only allows sortOrder=0 (1:1 mapping)",
        });
      }
    }
  }

  private async computeCoverageForLines(
    organizationId: string,
    fromBookId: string | null,
    lines: Array<{
      sourceAccountId: string;
      targetAccountId: string;
      sourceType: string;
      targetType: string;
      targetDeletedAt: Date | null;
      sortOrder: number;
    }>,
  ): Promise<LedgerMappingCoverage> {
    const nasAccounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        ...(fromBookId
          ? { accountingBookId: fromBookId }
          : { ledgerType: LedgerType.NAS }),
        deletedAt: null,
      },
      select: { id: true },
    });
    const nasIds = new Set(nasAccounts.map((a) => a.id));
    const mapped = new Set<string>();
    let typeMismatchCount = 0;
    let missingTargetCount = 0;
    let duplicateSourceCount = 0;
    const seenSource = new Set<string>();

    for (const l of lines) {
      if (seenSource.has(l.sourceAccountId)) duplicateSourceCount += 1;
      seenSource.add(l.sourceAccountId);
      if (nasIds.has(l.sourceAccountId)) mapped.add(l.sourceAccountId);
      if (l.targetDeletedAt != null) missingTargetCount += 1;
      if (l.sourceType !== l.targetType) typeMismatchCount += 1;
    }

    const nasAccountCount = nasIds.size;
    const mappedNasCount = mapped.size;
    const coveragePct =
      nasAccountCount === 0
        ? 0
        : Math.round((mappedNasCount / nasAccountCount) * 1000) / 10;

    const unmappedNasAccountIds = [...nasIds].filter((id) => !mapped.has(id));

    return {
      nasAccountCount,
      mappedNasCount,
      coveragePct,
      unmappedNasAccountIds: unmappedNasAccountIds.slice(0, 200),
      typeMismatchCount,
      missingTargetCount,
      duplicateSourceCount,
    };
  }

  private async assertActiveBookPair(
    organizationId: string,
    fromBookId: string,
    toBookId: string,
  ) {
    if (fromBookId === toBookId) {
      throw new BadRequestException({
        code: "MAPPING_BOOK_PAIR_SAME",
        message: "Source and target accounting books must differ",
      });
    }
    const books = await this.prisma.accountingBook.findMany({
      where: {
        organizationId,
        id: { in: [fromBookId, toBookId] },
        status: AccountingBookStatus.ACTIVE,
      },
      select: { id: true, code: true },
    });
    const fromBook = books.find((book) => book.id === fromBookId);
    const toBook = books.find((book) => book.id === toBookId);
    if (!fromBook || !toBook) {
      throw new BadRequestException({
        code: "MAPPING_BOOK_PAIR_INVALID",
        message: "Both mapping books must be active and belong to the organization",
      });
    }
    return { fromBook, toBook };
  }
}
