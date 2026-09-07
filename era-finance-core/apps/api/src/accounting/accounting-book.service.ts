import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountType,
  AccountingBookBillingSlotKind,
  AccountingBookGaapKind,
  AccountingBookStatus,
  LedgerMappingSetStatus,
  LedgerType,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";

export type AccountingBookDb = PrismaService | Prisma.TransactionClient;

export function ledgerTypeForBookGaap(
  gaapKind: AccountingBookGaapKind,
): LedgerType {
  if (gaapKind === AccountingBookGaapKind.IFRS) return LedgerType.IFRS;
  if (gaapKind === AccountingBookGaapKind.NAS) return LedgerType.NAS;
  return LedgerType.MANAGEMENT;
}

export type CreateAccountingBookInput = {
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  gaapKind: AccountingBookGaapKind;
  seedCoa?: boolean;
  coaStrategy?: "TEMPLATE" | "EMPTY" | "NAS_CLONE";
  translateFromStatutory?: boolean;
};

const MANAGEMENT_COA = [
  { code: "M1000", type: AccountType.ASSET, nameEn: "Management assets", nameAz: "İdarəetmə aktivləri", nameRu: "Управленческие активы" },
  { code: "M2000", type: AccountType.LIABILITY, nameEn: "Management liabilities", nameAz: "İdarəetmə öhdəlikləri", nameRu: "Управленческие обязательства" },
  { code: "M3000", type: AccountType.EQUITY, nameEn: "Management equity", nameAz: "İdarəetmə kapitalı", nameRu: "Управленческий капитал" },
  { code: "M4000", type: AccountType.REVENUE, nameEn: "Management revenue", nameAz: "İdarəetmə gəlirləri", nameRu: "Управленческие доходы" },
  { code: "M5000", type: AccountType.EXPENSE, nameEn: "Management expenses", nameAz: "İdarəetmə xərcləri", nameRu: "Управленческие расходы" },
] as const;

const SYSTEM_BOOKS = {
  NAS: {
    code: "NAS",
    nameAz: "Milli Mühasibat Uçotu Standartları",
    nameRu: "Национальные стандарты бухгалтерского учёта",
    nameEn: "National Accounting Standards",
    gaapKind: AccountingBookGaapKind.NAS,
    isSystem: true,
    isDefaultOps: true,
    status: AccountingBookStatus.ACTIVE,
    billingSlotKind: AccountingBookBillingSlotKind.INCLUDED,
    sortOrder: 0,
  },
  IFRS: {
    code: "IFRS",
    nameAz: "Beynəlxalq Maliyyə Hesabatı Standartları",
    nameRu: "Международные стандарты финансовой отчётности",
    nameEn: "International Financial Reporting Standards",
    gaapKind: AccountingBookGaapKind.IFRS,
    isSystem: true,
    isDefaultOps: false,
    status: AccountingBookStatus.ACTIVE,
    billingSlotKind: AccountingBookBillingSlotKind.EXTRA,
    sortOrder: 10,
  },
} as const;

@Injectable()
export class AccountingBookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async ensureSystemBooks(
    organizationId: string,
    opts: { createIfrs?: boolean } = {},
    db: AccountingBookDb = this.prisma,
  ) {
    const nas = await this.upsertSystemBook(
      db,
      organizationId,
      SYSTEM_BOOKS.NAS,
    );
    const ifrs = opts.createIfrs
      ? await this.upsertSystemBook(db, organizationId, SYSTEM_BOOKS.IFRS)
      : null;

    await Promise.all([
      db.account.updateMany({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          NOT: { accountingBookId: nas.id },
        },
        data: { accountingBookId: nas.id },
      }),
      db.journalEntry.updateMany({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountingBookId: null,
        },
        data: { accountingBookId: nas.id },
      }),
    ]);

    if (ifrs) {
      await Promise.all([
        db.account.updateMany({
          where: {
            organizationId,
            ledgerType: LedgerType.IFRS,
            NOT: { accountingBookId: ifrs.id },
          },
          data: { accountingBookId: ifrs.id },
        }),
        db.journalEntry.updateMany({
          where: {
            organizationId,
            ledgerType: LedgerType.IFRS,
            accountingBookId: null,
          },
          data: { accountingBookId: ifrs.id },
        }),
        db.ledgerMappingSet.updateMany({
          where: {
            organizationId,
            code: "NAS_TO_IFRS",
          },
          data: {
            fromBookId: nas.id,
            toBookId: ifrs.id,
          },
        }),
      ]);
    }
    return { nas, ifrs };
  }

  listBooks(organizationId: string) {
    return this.prisma.accountingBook.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
  }

  async getSlots(organizationId: string) {
    const slots = await this.subscriptionAccess.getAccountingBookSlots(
      organizationId,
    );
    const usedActive = await this.prisma.accountingBook.count({
      where: { organizationId, status: AccountingBookStatus.ACTIVE },
    });
    return { ...slots, usedActive };
  }

  async getBook(
    organizationId: string,
    id: string,
    db: AccountingBookDb = this.prisma,
  ) {
    const book = await db.accountingBook.findFirst({
      where: { id, organizationId },
    });
    if (!book) {
      throw new NotFoundException("Accounting book not found");
    }
    return book;
  }

  /** Active book by stable org-local code (holdings cross-org key). */
  async findActiveByCode(
    organizationId: string,
    code: string,
    db: AccountingBookDb = this.prisma,
  ) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;
    return db.accountingBook.findFirst({
      where: {
        organizationId,
        code: normalized,
        status: AccountingBookStatus.ACTIVE,
      },
    });
  }

  async resolveByLedgerType(
    organizationId: string,
    ledgerType: LedgerType | "NAS" | "IFRS",
    db: AccountingBookDb = this.prisma,
  ) {
    const alias = String(ledgerType).trim().toUpperCase();
    if (alias !== LedgerType.NAS && alias !== LedgerType.IFRS) {
      throw new BadRequestException("ledgerType must be NAS or IFRS");
    }
    const book = await db.accountingBook.findFirst({
      where: {
        organizationId,
        code: alias,
        status: AccountingBookStatus.ACTIVE,
      },
    });
    if (!book) {
      throw new NotFoundException(`Active ${alias} accounting book not found`);
    }
    return book;
  }

  resolveByIdOrLedgerAlias(
    organizationId: string,
    bookId?: string,
    ledgerType?: string,
    db: AccountingBookDb = this.prisma,
  ) {
    const normalizedBookId = bookId?.trim();
    if (normalizedBookId) {
      return this.getBook(organizationId, normalizedBookId, db);
    }
    return this.resolveByLedgerType(
      organizationId,
      (ledgerType?.trim().toUpperCase() || LedgerType.NAS) as
        | LedgerType
        | "NAS"
        | "IFRS",
      db,
    );
  }

  async resolveDefaultOpsBook(
    organizationId: string,
    db: AccountingBookDb = this.prisma,
  ) {
    const book = await db.accountingBook.findFirst({
      where: {
        organizationId,
        status: AccountingBookStatus.ACTIVE,
        OR: [{ isDefaultOps: true }, { code: "NAS" }],
      },
      orderBy: [{ isDefaultOps: "desc" }, { code: "asc" }],
    });
    if (!book) {
      throw new NotFoundException("Active default operations accounting book not found");
    }
    return book;
  }

  async createBook(
    organizationId: string,
    input: CreateAccountingBookInput,
  ) {
    if (input.gaapKind === AccountingBookGaapKind.NAS) {
      throw new BadRequestException({
        code: "ACCOUNTING_BOOK_GAAP_INVALID",
        message: "A second NAS system book cannot be created",
      });
    }
    const code = input.code.trim().toUpperCase();
    if (code === "NAS" || code === "IFRS") {
      throw new BadRequestException({
        code: "ACCOUNTING_BOOK_CODE_RESERVED",
        message: "NAS and IFRS codes are reserved for system books",
      });
    }

    const slots = await this.subscriptionAccess.getAccountingBookSlots(
      organizationId,
    );
    const coaStrategy =
      input.coaStrategy ??
      (input.gaapKind === AccountingBookGaapKind.MANAGEMENT &&
      input.seedCoa !== false
        ? "TEMPLATE"
        : "EMPTY");
    if (
      coaStrategy === "TEMPLATE" &&
      input.gaapKind !== AccountingBookGaapKind.MANAGEMENT
    ) {
      throw new BadRequestException({
        code: "ACCOUNTING_BOOK_TEMPLATE_UNAVAILABLE",
        message: "The starter template is available only for MANAGEMENT books",
      });
    }

    return this.prisma.$transaction(
      async (tx) => {
        const usedActive = await tx.accountingBook.count({
          where: { organizationId, status: AccountingBookStatus.ACTIVE },
        });
        if (usedActive >= slots.maxActive) {
          throw new HttpException(
            {
              statusCode: HttpStatus.PAYMENT_REQUIRED,
              code: "ACCOUNTING_BOOK_SLOT_REQUIRED",
              message: "An additional accounting book slot is required",
              ...slots,
              usedActive,
            },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }

        const maxSort = await tx.accountingBook.aggregate({
          where: { organizationId },
          _max: { sortOrder: true },
        });
        const book = await tx.accountingBook.create({
          data: {
            organizationId,
            code,
            nameAz: input.nameAz.trim(),
            nameRu: input.nameRu.trim(),
            nameEn: input.nameEn.trim(),
            gaapKind: input.gaapKind,
            isSystem: false,
            isDefaultOps: false,
            status: AccountingBookStatus.ACTIVE,
            billingSlotKind: AccountingBookBillingSlotKind.EXTRA,
            sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
          },
        });

        if (coaStrategy === "TEMPLATE") {
          await tx.account.createMany({
            data: MANAGEMENT_COA.map((account) => ({
              ...account,
              organizationId,
              accountingBookId: book.id,
              ledgerType: LedgerType.MANAGEMENT,
            })),
          });
        }

        const sourceBook =
          coaStrategy === "NAS_CLONE" || input.translateFromStatutory
            ? await tx.accountingBook.findFirst({
                where: {
                  organizationId,
                  status: AccountingBookStatus.ACTIVE,
                  OR: [{ code: "NAS" }, { isDefaultOps: true }],
                },
                orderBy: [{ isDefaultOps: "desc" }, { code: "asc" }],
              })
            : null;
        if (
          (coaStrategy === "NAS_CLONE" || input.translateFromStatutory) &&
          !sourceBook
        ) {
          throw new BadRequestException({
            code: "ACCOUNTING_BOOK_STATUTORY_SOURCE_MISSING",
            message: "An active NAS/default operations book is required",
          });
        }

        const clonedPairs: Array<{
          sourceAccountId: string;
          targetAccountId: string;
        }> = [];
        if (coaStrategy === "NAS_CLONE" && sourceBook) {
          const sourceAccounts = await tx.account.findMany({
            where: {
              organizationId,
              accountingBookId: sourceBook.id,
              deletedAt: null,
            },
            select: {
              id: true,
              code: true,
              nameAz: true,
              nameRu: true,
              nameEn: true,
              type: true,
              currency: true,
              parentId: true,
            },
            orderBy: { code: "asc" },
          });
          const targetBySource = new Map<string, string>();
          const targetLedgerType = ledgerTypeForBookGaap(input.gaapKind);
          for (const account of sourceAccounts) {
            const cloned = await tx.account.create({
              data: {
                organizationId,
                accountingBookId: book.id,
                ledgerType: targetLedgerType,
                code: account.code,
                nameAz: account.nameAz,
                nameRu: account.nameRu,
                nameEn: account.nameEn,
                type: account.type,
                currency: account.currency,
              },
              select: { id: true },
            });
            targetBySource.set(account.id, cloned.id);
            clonedPairs.push({
              sourceAccountId: account.id,
              targetAccountId: cloned.id,
            });
          }
          for (const account of sourceAccounts) {
            const parentId = account.parentId
              ? targetBySource.get(account.parentId)
              : undefined;
            const targetId = targetBySource.get(account.id);
            if (parentId && targetId) {
              await tx.account.update({
                where: { id: targetId },
                data: { parentId },
              });
            }
          }
        }

        if (input.translateFromStatutory && sourceBook) {
          const mappingCode = `${sourceBook.code}_TO_${book.code}`;
          const latest = await tx.ledgerMappingSet.findFirst({
            where: { organizationId, code: mappingCode },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const mappingSet = await tx.ledgerMappingSet.create({
            data: {
              organizationId,
              code: mappingCode,
              version: (latest?.version ?? 0) + 1,
              status: LedgerMappingSetStatus.DRAFT,
              fromBookId: sourceBook.id,
              toBookId: book.id,
            },
            select: { id: true },
          });
          if (clonedPairs.length > 0) {
            await tx.ledgerMappingLine.createMany({
              data: clonedPairs.map((pair) => ({
                mappingSetId: mappingSet.id,
                ...pair,
                ratio: new Prisma.Decimal(1),
                sortOrder: 0,
              })),
            });
          }
        }
        return book;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async retireBook(organizationId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const book = await this.getBook(organizationId, id, tx);
      if (book.status === AccountingBookStatus.RETIRED) {
        return book;
      }
      if (
        book.isSystem ||
        book.isDefaultOps ||
        book.billingSlotKind !== AccountingBookBillingSlotKind.EXTRA
      ) {
        throw new BadRequestException({
          code: "ACCOUNTING_BOOK_RETIRE_PROTECTED",
          message: "Only non-system EXTRA accounting books can be retired",
        });
      }

      const [journalEntryCount, organization] = await Promise.all([
        tx.journalEntry.count({
          where: { organizationId, accountingBookId: id },
        }),
        tx.organization.findUnique({
          where: { id: organizationId },
          select: { settings: true },
        }),
      ]);
      if (journalEntryCount > 0) {
        throw new BadRequestException({
          code: "ACCOUNTING_BOOK_RETIRE_HAS_ENTRIES",
          message: "Accounting books with journal entries cannot be retired",
        });
      }

      const settings =
        organization?.settings &&
        typeof organization.settings === "object" &&
        !Array.isArray(organization.settings)
          ? (organization.settings as Record<string, unknown>)
          : {};
      const reporting =
        settings.reporting &&
        typeof settings.reporting === "object" &&
        !Array.isArray(settings.reporting)
          ? (settings.reporting as Record<string, unknown>)
          : {};
      const byBook = reporting.closedPeriodsByBookId;
      const closedPeriods =
        byBook && typeof byBook === "object" && !Array.isArray(byBook)
          ? (byBook as Record<string, unknown>)[id]
          : undefined;
      if (Array.isArray(closedPeriods) && closedPeriods.length > 0) {
        throw new BadRequestException({
          code: "ACCOUNTING_BOOK_RETIRE_CLOSED_PERIODS",
          message: "Accounting books with closed periods cannot be retired",
        });
      }

      return tx.accountingBook.update({
        where: { id },
        data: { status: AccountingBookStatus.RETIRED },
      });
    });
  }

  async getDefaultOpsBook(
    organizationId: string,
    db: AccountingBookDb = this.prisma,
  ) {
    const book = await db.accountingBook.findFirst({
      where: {
        organizationId,
        isDefaultOps: true,
        status: AccountingBookStatus.ACTIVE,
      },
    });
    if (book) return book;
    return this.resolveByLedgerType(organizationId, LedgerType.NAS, db);
  }

  private upsertSystemBook(
    db: AccountingBookDb,
    organizationId: string,
    data: (typeof SYSTEM_BOOKS)[keyof typeof SYSTEM_BOOKS],
  ) {
    return db.accountingBook.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: data.code,
        },
      },
      create: {
        organizationId,
        ...data,
      },
      update: {
        nameAz: data.nameAz,
        nameRu: data.nameRu,
        nameEn: data.nameEn,
        gaapKind: data.gaapKind,
        isSystem: data.isSystem,
        isDefaultOps: data.isDefaultOps,
        billingSlotKind: data.billingSlotKind,
        sortOrder: data.sortOrder,
      },
    });
  }
}
