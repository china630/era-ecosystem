import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  Decimal,
  LedgerMappingSetStatus,
  LedgerType,
  Prisma,
  TransactionMirrorStatus,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import {
  LEDGER_MAPPING_CODE_NAS_TO_IFRS,
  MIRROR_ERROR,
  type MirrorErrorCode,
  type LedgerMirrorMode,
  parseLedgerMirrorMode,
} from "./ledger-mapping.constants";
import type { SubcontoService } from "./subconto.service";
import {
  AccountingBookService,
  ledgerTypeForBookGaap,
} from "./accounting-book.service";

export type MirrorNasLine = {
  accountId: string;
  accountCode: string;
  debit: Decimal;
  credit: Decimal;
  journalEntryId: string;
};

export type MirrorSourceLine = MirrorNasLine;

export type MirrorOutcome = {
  status: TransactionMirrorStatus;
  mappingSetId?: string | null;
  errorCode?: MirrorErrorCode | null;
  errorDetail?: Record<string, unknown> | null;
  runs?: MirrorRunOutcome[];
};

export type MirrorRunOutcome = {
  mappingSetId: string;
  mappingSetCode: string;
  toBookId: string | null;
  status: TransactionMirrorStatus;
  errorCode?: MirrorErrorCode | null;
  errorDetail?: Record<string, unknown> | null;
};

type TxClient = Prisma.TransactionClient;

@Injectable()
export class IfrsAutoMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    @Optional()
    private readonly accountingBooks?: AccountingBookService,
  ) {}

  async mirrorFromBook(params: {
    tx: TxClient;
    organizationId: string;
    transactionId: string;
    sourceLines: MirrorSourceLine[];
    sourceBookId?: string | null;
    sourceLedgerType: LedgerType;
    subcontoService?: SubcontoService;
    mode?: LedgerMirrorMode;
    entitled: boolean;
  }): Promise<MirrorOutcome> {
    if (!params.entitled || params.sourceLines.length === 0) {
      return this.mirrorSingleFromBook(params);
    }

    const candidates = params.sourceBookId
      ? await params.tx.ledgerMappingSet.findMany({
          where: {
            organizationId: params.organizationId,
            fromBookId: params.sourceBookId,
            toBookId: { not: params.sourceBookId },
            status: LedgerMappingSetStatus.PUBLISHED,
          },
          select: { id: true, code: true, toBookId: true },
          orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        })
      : [];
    if (candidates.length <= 1) {
      return this.mirrorSingleFromBook({
        ...params,
        mappingSetId: candidates[0]?.id,
      });
    }

    const ordered =
      params.sourceLedgerType === LedgerType.NAS
        ? [
            ...candidates.filter(
              (set) => set.code === LEDGER_MAPPING_CODE_NAS_TO_IFRS,
            ),
            ...candidates.filter(
              (set) => set.code !== LEDGER_MAPPING_CODE_NAS_TO_IFRS,
            ),
          ]
        : candidates;
    const runs: MirrorRunOutcome[] = [];
    for (const candidate of ordered) {
      const outcome = await this.mirrorSingleFromBook({
        ...params,
        mappingSetId: candidate.id,
      });
      runs.push({
        mappingSetId: candidate.id,
        mappingSetCode: candidate.code,
        toBookId: candidate.toBookId,
        status: outcome.status,
        errorCode: outcome.errorCode ?? null,
        errorDetail: outcome.errorDetail ?? null,
      });
    }
    const primary = runs[0];
    return this.persistOutcome(params.tx, params.transactionId, {
      status: primary.status,
      mappingSetId: primary.mappingSetId,
      errorCode: primary.errorCode ?? null,
      errorDetail: {
        primaryMappingSetId: primary.mappingSetId,
        mirrorRuns: runs,
      },
      runs,
    });
  }

  private async mirrorSingleFromBook(params: {
    tx: TxClient;
    organizationId: string;
    transactionId: string;
    sourceLines: MirrorSourceLine[];
    sourceBookId?: string | null;
    sourceLedgerType: LedgerType;
    subcontoService?: SubcontoService;
    mode?: LedgerMirrorMode;
    /** Caller resolves ifrs_mapping entitlement. */
    entitled: boolean;
    mappingSetId?: string;
  }): Promise<MirrorOutcome> {
    const {
      tx,
      organizationId,
      transactionId,
      sourceLines,
      sourceBookId,
      sourceLedgerType,
      subcontoService,
      entitled,
    } = params;

    if (sourceLines.length === 0) {
      return this.persistOutcome(tx, transactionId, {
        status: TransactionMirrorStatus.NONE,
      });
    }

    if (!entitled) {
      await this.clearMirroredLines(tx, sourceLines);
      return this.persistOutcome(tx, transactionId, {
        status: TransactionMirrorStatus.NONE,
      });
    }

    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const mode = params.mode ?? parseLedgerMirrorMode(org?.settings);

    const published = await this.resolvePublishedSet(tx, {
      organizationId,
      sourceBookId,
      sourceLedgerType,
      mappingSetId: params.mappingSetId,
    });

    if (!published) {
      if (sourceLedgerType !== LedgerType.NAS) {
        await this.clearMirroredLines(tx, sourceLines);
        return this.persistOutcome(tx, transactionId, {
          status: TransactionMirrorStatus.NONE,
        });
      }
      return this.failOrAbort(tx, transactionId, mode, {
        status: TransactionMirrorStatus.FAILED,
        errorCode: MIRROR_ERROR.NO_PUBLISHED_SET,
        errorDetail: { message: "No PUBLISHED NAS_TO_IFRS mapping set" },
      }, sourceLines);
    }

    if (published.lines.length === 0) {
      return this.failOrAbort(tx, transactionId, mode, {
        status: TransactionMirrorStatus.FAILED,
        mappingSetId: published.id,
        errorCode: MIRROR_ERROR.NO_PUBLISHED_SET,
        errorDetail: {
          message: `PUBLISHED ${published.code} mapping set has no lines`,
        },
      }, sourceLines, published.toBook?.id);
    }

    const lineBySource = new Map<string, (typeof published.lines)[number]>();
    for (const line of published.lines) {
      if (!lineBySource.has(line.sourceAccountId)) {
        lineBySource.set(line.sourceAccountId, line);
      }
    }

    const missing: Array<{ accountId: string; accountCode: string }> = [];
    const typeMismatches: Array<{
      sourceCode: string;
      targetCode: string;
      sourceType: string;
      targetType: string;
    }> = [];
    const missingTargets: Array<{ sourceCode: string; targetId: string }> = [];

    type Staged = {
      accountId: string;
      debit: Decimal;
      credit: Decimal;
      sourceJournalEntryId: string;
      mappingLineId: string;
    };
    const staged: Staged[] = [];

    for (const source of sourceLines) {
      const mapLine = lineBySource.get(source.accountId);
      if (!mapLine) {
        missing.push({
          accountId: source.accountId,
          accountCode: source.accountCode,
        });
        continue;
      }
      if (mapLine.targetAccount.deletedAt != null) {
        missingTargets.push({
          sourceCode: mapLine.sourceAccount.code,
          targetId: mapLine.targetAccountId,
        });
        continue;
      }
      if (mapLine.sourceAccount.type !== mapLine.targetAccount.type) {
        typeMismatches.push({
          sourceCode: mapLine.sourceAccount.code,
          targetCode: mapLine.targetAccount.code,
          sourceType: mapLine.sourceAccount.type,
          targetType: mapLine.targetAccount.type,
        });
        continue;
      }
      const ratio = new Decimal(mapLine.ratio);
      staged.push({
        accountId: mapLine.targetAccountId,
        debit: new Decimal(source.debit).mul(ratio),
        credit: new Decimal(source.credit).mul(ratio),
        sourceJournalEntryId: source.journalEntryId,
        mappingLineId: mapLine.id,
      });
    }

    if (missing.length > 0) {
      return this.failOrAbort(tx, transactionId, mode, {
        status: TransactionMirrorStatus.FAILED,
        mappingSetId: published.id,
        errorCode: MIRROR_ERROR.MISSING_IFRS_MAPPING,
        errorDetail: { missing },
      }, sourceLines, published.toBook?.id);
    }
    if (missingTargets.length > 0) {
      return this.failOrAbort(tx, transactionId, mode, {
        status: TransactionMirrorStatus.FAILED,
        mappingSetId: published.id,
        errorCode: MIRROR_ERROR.TARGET_ACCOUNT_MISSING,
        errorDetail: { missingTargets },
      }, sourceLines, published.toBook?.id);
    }
    if (typeMismatches.length > 0) {
      return this.failOrAbort(tx, transactionId, mode, {
        status: TransactionMirrorStatus.FAILED,
        mappingSetId: published.id,
        errorCode: MIRROR_ERROR.SEMANTIC_TYPE_MISMATCH,
        errorDetail: { typeMismatches },
      }, sourceLines, published.toBook?.id);
    }

    let sumDr = new Decimal(0);
    let sumCr = new Decimal(0);
    for (const line of staged) {
      sumDr = sumDr.add(line.debit);
      sumCr = sumCr.add(line.credit);
    }
    if (!sumDr.equals(sumCr)) {
      return this.failOrAbort(tx, transactionId, mode, {
        status: TransactionMirrorStatus.FAILED,
        mappingSetId: published.id,
        errorCode: MIRROR_ERROR.IFRS_UNBALANCED,
        errorDetail: {
          debit: sumDr.toFixed(4),
          credit: sumCr.toFixed(4),
        },
      }, sourceLines, published.toBook?.id);
    }

    // All-or-nothing: drop any prior derived lines before (re)writing.
    await this.clearMirroredLines(tx, sourceLines, published.toBook?.id);
    const targetBook = published.toBook ?? (
      this.accountingBooks && sourceLedgerType === LedgerType.NAS
        ? await this.accountingBooks.resolveByLedgerType(
          organizationId,
          LedgerType.IFRS,
          tx,
        )
        : null
    );
    const targetLedgerType = targetBook
      ? ledgerTypeForBookGaap(targetBook.gaapKind)
      : LedgerType.IFRS;

    for (const line of staged) {
      try {
        const mirroredEntry = await tx.journalEntry.create({
          data: {
            organizationId,
            transactionId,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            ledgerType: targetLedgerType,
            ...(targetBook ? { accountingBookId: targetBook.id } : {}),
            sourceJournalEntryId: line.sourceJournalEntryId,
            mappingLineId: line.mappingLineId,
          },
        });
        if (subcontoService) {
          await subcontoService.copyDimensionsToMirroredEntry(
            tx,
            line.sourceJournalEntryId,
            mirroredEntry.id,
          );
        }
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          // Concurrent idempotent create — treat as success for this line.
          continue;
        }
        throw err;
      }
    }

    return this.persistOutcome(tx, transactionId, {
      status: TransactionMirrorStatus.POSTED,
      mappingSetId: published.id,
      errorCode: null,
      errorDetail: null,
    });
  }

  async mirrorFromNas(params: {
    tx: TxClient;
    organizationId: string;
    transactionId: string;
    nasLines: MirrorNasLine[];
    sourceBookId?: string | null;
    subcontoService?: SubcontoService;
    mode?: LedgerMirrorMode;
    entitled: boolean;
  }): Promise<MirrorOutcome> {
    return this.mirrorFromBook({
      ...params,
      sourceLines: params.nasLines,
      sourceLedgerType: LedgerType.NAS,
    });
  }

  async retryFailedMirror(
    organizationId: string,
    transactionId: string,
    subcontoService?: SubcontoService,
  ): Promise<MirrorOutcome> {
    const entitled = await this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.IFRS_MAPPING,
    );
    if (!entitled) {
      throw new ForbiddenException({
        code: "MIRROR_RETRY_NOT_ENTITLED",
        message: "ifrsMapping entitlement required to retry IFRS mirror",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.transaction.findFirst({
        where: { id: transactionId, organizationId },
        include: {
          journalEntries: {
            where: { sourceJournalEntryId: null },
            include: { account: { select: { id: true, code: true } } },
          },
        },
      });
      if (!row) throw new NotFoundException("Transaction not found");
      if (row.mirrorStatus !== TransactionMirrorStatus.FAILED) {
        throw new BadRequestException({
          code: "MIRROR_RETRY_NOT_FAILED",
          message: "Only FAILED mirrors can be retried",
        });
      }

      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });
      const mode = parseLedgerMirrorMode(org?.settings);

      const source = row.journalEntries[0];
      if (!source) {
        throw new BadRequestException({
          code: "MIRROR_RETRY_NO_SOURCE_LINES",
          message: "No source journal lines found for mirror retry",
        });
      }
      const sourceLines: MirrorSourceLine[] = row.journalEntries.map((je) => ({
        accountId: je.accountId,
        accountCode: je.account.code,
        debit: je.debit,
        credit: je.credit,
        journalEntryId: je.id,
      }));

      return this.mirrorFromBook({
        tx,
        organizationId,
        transactionId,
        sourceLines,
        sourceBookId: source.accountingBookId,
        sourceLedgerType: source.ledgerType,
        subcontoService,
        mode,
        entitled: true,
      });
    });
  }

  private async resolvePublishedSet(
    tx: TxClient,
    params: {
      organizationId: string;
      sourceBookId?: string | null;
      sourceLedgerType: LedgerType;
      mappingSetId?: string;
    },
  ) {
    const include = {
      toBook: {
        select: { id: true, gaapKind: true },
      },
      lines: {
        include: {
          sourceAccount: {
            select: { id: true, code: true, type: true, deletedAt: true },
          },
          targetAccount: {
            select: { id: true, code: true, type: true, deletedAt: true },
          },
        },
        orderBy: { sortOrder: "asc" as const },
      },
    };

    if (params.sourceBookId) {
      const candidates = await tx.ledgerMappingSet.findMany({
        where: {
          ...(params.mappingSetId ? { id: params.mappingSetId } : {}),
          organizationId: params.organizationId,
          fromBookId: params.sourceBookId,
          toBookId: { not: params.sourceBookId },
          status: LedgerMappingSetStatus.PUBLISHED,
        },
        include,
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
      });
      const preferred =
        params.sourceLedgerType === LedgerType.NAS
          ? candidates.find(
              (set) => set.code === LEDGER_MAPPING_CODE_NAS_TO_IFRS,
            )
          : undefined;
      if (preferred || candidates[0]) return preferred ?? candidates[0];
    }

    if (params.sourceLedgerType !== LedgerType.NAS) return null;
    return tx.ledgerMappingSet.findFirst({
      where: {
        organizationId: params.organizationId,
        code: LEDGER_MAPPING_CODE_NAS_TO_IFRS,
        status: LedgerMappingSetStatus.PUBLISHED,
      },
      include,
      orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
    });
  }

  private async clearMirroredLines(
    tx: TxClient,
    sourceLines: MirrorSourceLine[],
    targetBookId?: string | null,
  ): Promise<void> {
    await tx.journalEntry.deleteMany({
      where: {
        sourceJournalEntryId: {
          in: sourceLines.map((line) => line.journalEntryId),
        },
        ...(targetBookId ? { accountingBookId: targetBookId } : {}),
      },
    });
  }

  private async failOrAbort(
    tx: TxClient,
    transactionId: string,
    mode: LedgerMirrorMode,
    outcome: MirrorOutcome,
    sourceLines: MirrorSourceLine[],
    targetBookId?: string | null,
  ): Promise<MirrorOutcome> {
    if (mode === "strict") {
      throw new BadRequestException({
        code: outcome.errorCode ?? MIRROR_ERROR.MISSING_IFRS_MAPPING,
        message: "IFRS mirror failed (strict mode)",
        detail: outcome.errorDetail ?? undefined,
      });
    }
    // Soft: ensure zero derived lines (no partial / orphan leftovers).
    await this.clearMirroredLines(tx, sourceLines, targetBookId);
    return this.persistOutcome(tx, transactionId, outcome);
  }

  private async persistOutcome(
    tx: TxClient,
    transactionId: string,
    outcome: MirrorOutcome,
  ): Promise<MirrorOutcome> {
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        mirrorStatus: outcome.status,
        mirrorMappingSetId: outcome.mappingSetId ?? null,
        mirrorErrorCode: outcome.errorCode ?? null,
        mirrorErrorDetail:
          outcome.errorDetail == null
            ? Prisma.DbNull
            : (outcome.errorDetail as Prisma.InputJsonValue),
      },
    });
    return outcome;
  }
}
