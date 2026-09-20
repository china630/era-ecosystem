import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { TemplateAccount } from "@prisma/client";
import {
  AccountType,
  LedgerType,
  OrganizationKind,
  pickAccountDisplayName,
  Prisma,
} from "@erafinance/database";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { LedgerMappingService } from "../accounting/ledger-mapping.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { AccountingBookService } from "../accounting/accounting-book.service";
import type { CreateAccountMappingDto } from "./dto/create-account-mapping.dto";
import type { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import type { CreateIfrsMappingRuleDto } from "./dto/create-ifrs-mapping-rule.dto";
import type { UpdateIfrsMappingRuleDto } from "./dto/update-ifrs-mapping-rule.dto";

/** Клиент БД для операций счетов внутри `prisma.$transaction`. */
export type AccountsDb = PrismaService | Prisma.TransactionClient;

const Decimal = Prisma.Decimal;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PostingAccountResolver,
    private readonly ledgerMapping: LedgerMappingService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    @Optional()
    private readonly accountingBooks?: AccountingBookService,
  ) {}

  async listAccounts(
    organizationId: string,
    ledgerType: LedgerType,
    locale?: string | null,
    accountingBookId?: string,
  ) {
    const book = this.accountingBooks
      ? await this.accountingBooks.resolveByIdOrLedgerAlias(
          organizationId,
          accountingBookId,
          ledgerType,
        )
      : null;
    const resolvedLedgerType =
      book?.gaapKind === "IFRS"
        ? LedgerType.IFRS
        : book?.gaapKind === "MANAGEMENT"
          ? LedgerType.MANAGEMENT
          : book
            ? LedgerType.NAS
            : ledgerType;
    return this.prisma.account
      .findMany({
        where: {
          organizationId,
          ledgerType: resolvedLedgerType,
          ...(book ? { accountingBookId: book.id } : {}),
        },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          type: true,
          ledgerType: true,
          currency: true,
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          displayName: pickAccountDisplayName(r, locale),
        })),
      );
  }

  /**
   * Глобальный справочник кассы: приоритет `template_accounts`, иначе legacy
   * `chart_of_accounts_entries`.
   */
  async listCashChartCatalogEntries(
    locale?: string | null,
    kind: OrganizationKind = OrganizationKind.COMMERCIAL,
  ) {
    const tplCount = await this.prisma.templateAccount.count({
      where: { isDeprecated: false, kind, cashProfile: { not: null } },
    });
    if (tplCount > 0) {
      const rows = await this.prisma.templateAccount.findMany({
        where: { isDeprecated: false, kind, cashProfile: { not: null } },
        orderBy: [{ cashProfile: "asc" }, { code: "asc" }],
        select: {
          code: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          cashProfile: true,
        },
      });
      return rows.map((r) => ({
        ...r,
        displayName: pickAccountDisplayName(r, locale),
      }));
    }

    return this.prisma.chartOfAccountsEntry
      .findMany({
        where: { isDeprecated: false, kind, cashProfile: { not: null } },
        orderBy: [{ cashProfile: "asc" }, { code: "asc" }],
        select: {
          code: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          cashProfile: true,
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          displayName: pickAccountDisplayName(r, locale),
        })),
      );
  }

  /**
   * Счета из глобального `template_accounts`, которых ещё нет среди NAS-счетов организации.
   */
  async listNasTemplateCatalogForImport(
    organizationId: string,
    opts: {
      search?: string;
      locale?: string | null;
      kind?: OrganizationKind;
    },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { kind: true },
    });
    const kind = opts.kind ?? org?.kind ?? OrganizationKind.COMMERCIAL;
    const existingCodes = (
      await this.prisma.account.findMany({
        where: { organizationId, ledgerType: LedgerType.NAS },
        select: { code: true },
      })
    ).map((a) => a.code);

    const where: Prisma.TemplateAccountWhereInput = {
      isDeprecated: false,
      ...(existingCodes.length > 0 ? { code: { notIn: existingCodes } } : {}),
    };

    where.kind = kind;

    const s = opts.search?.trim();
    if (s) {
      where.AND = [
        {
          OR: [
            { code: { contains: s, mode: "insensitive" } },
            { nameAz: { contains: s, mode: "insensitive" } },
            { nameRu: { contains: s, mode: "insensitive" } },
            { nameEn: { contains: s, mode: "insensitive" } },
          ],
        },
      ];
    }

    const rows = await this.prisma.templateAccount.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      take: 250,
      select: {
        id: true,
        code: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
        accountType: true,
        parentCode: true,
        kind: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      displayName: pickAccountDisplayName(r, opts.locale),
    }));
  }

  /**
   * Добавляет в локальный NAS-план строку из глобального шаблона (с цепочкой родителей при необходимости).
   */
  async importNasAccountFromTemplate(
    organizationId: string,
    templateAccountId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.accountingBooks?.ensureSystemBooks(organizationId, {}, tx);
      const nasBook = this.accountingBooks
        ? await this.accountingBooks.resolveByLedgerType(
            organizationId,
            LedgerType.NAS,
            tx,
          )
        : null;
      if (!nasBook) {
        throw new NotFoundException("Active NAS accounting book not found");
      }

      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { kind: true },
      });
      const kind = org?.kind ?? OrganizationKind.COMMERCIAL;

      const leaf = await tx.templateAccount.findUnique({
        where: { id: templateAccountId },
      });
      if (!leaf || leaf.isDeprecated) {
        throw new NotFoundException("Template account not found");
      }

      const existingLeaf = await tx.account.findFirst({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountingBookId: nasBook.id,
          code: leaf.code,
        },
      });
      if (existingLeaf) {
        throw new ConflictException(`NAS account ${leaf.code} already exists`);
      }

      const chain: TemplateAccount[] = [];
      let cur: TemplateAccount | null = leaf;
      while (cur) {
        chain.unshift(cur);
        const pc = (cur.parentCode ?? "").trim();
        if (!pc) break;
        const parentTpl: TemplateAccount | null = await tx.templateAccount.findUnique({
          where: {
            kind_code: {
              kind,
              code: pc,
            },
          },
        });
        if (!parentTpl) {
          throw new BadRequestException(
            `Parent template for code ${cur.code} not found (${pc})`,
          );
        }
        cur = parentTpl;
      }

      const idByCode = new Map<string, string>();

      for (const row of chain) {
        const acc = await tx.account.findFirst({
          where: {
            organizationId,
            ledgerType: LedgerType.NAS,
            accountingBookId: nasBook.id,
            code: row.code,
          },
        });
        if (acc) {
          idByCode.set(row.code, acc.id);
          continue;
        }

        const parentId = row.parentCode?.trim()
          ? idByCode.get(row.parentCode.trim()) ?? null
          : null;

        const catalogRow = await tx.chartOfAccountsEntry.findFirst({
          where: { kind, code: row.code },
        });

        const created = await tx.account.create({
          data: {
            organizationId,
            accountingBookId: nasBook.id,
            code: row.code,
            nameAz: row.nameAz,
            nameRu: row.nameRu,
            nameEn: row.nameEn,
            type: row.accountType,
            ledgerType: LedgerType.NAS,
            parentId,
            chartEntryId: catalogRow?.id ?? null,
            templateAccountId: row.id,
          },
          select: {
            id: true,
            code: true,
            nameAz: true,
            nameRu: true,
            nameEn: true,
            type: true,
            ledgerType: true,
            parentId: true,
            templateAccountId: true,
          },
        });
        idByCode.set(row.code, created.id);
      }

      // P1: do not clone full NAS→IFRS on single-account import.
      // Use bootstrapMultiGaap / provisionIfrsFromTemplate for IFRS CoA.

      return tx.account.findFirstOrThrow({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountingBookId: nasBook.id,
          code: leaf.code,
        },
        select: {
          id: true,
          code: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          type: true,
          ledgerType: true,
          parentId: true,
          templateAccountId: true,
        },
      });
    });
  }

  /**
   * Ops escape hatch: clone NAS CoA into IFRS (same codes). Not used on onboarding (P1).
   */
  async mirrorNasToIfrs(
    organizationId: string,
    db: AccountsDb = this.prisma,
  ): Promise<{ created: number; warning: string }> {
    const systemBooks = await this.accountingBooks?.ensureSystemBooks(
      organizationId,
      { createIfrs: true },
      db,
    );
    const ifrsBook = systemBooks?.ifrs;
    if (!ifrsBook) {
      throw new NotFoundException("Active IFRS accounting book not found");
    }

    const nasAll = await db.account.findMany({
      where: { organizationId, ledgerType: LedgerType.NAS },
      orderBy: { code: "asc" },
    });
    if (nasAll.length === 0) {
      return {
        created: 0,
        warning: "No NAS accounts to clone",
      };
    }

    const existingIfrs = await db.account.findMany({
      where: {
        organizationId,
        ledgerType: LedgerType.IFRS,
        accountingBookId: ifrsBook.id,
      },
      select: { id: true, code: true },
    });
    const ifrsByCode = new Map(existingIfrs.map((a) => [a.code, a]));

    const nasIdToIfrsId = new Map<string, string>();
    for (const n of nasAll) {
      const ex = ifrsByCode.get(n.code);
      if (ex) nasIdToIfrsId.set(n.id, ex.id);
    }

    let created = 0;
    let pending = nasAll.filter((n) => !nasIdToIfrsId.has(n.id));
    let guard = 0;
    while (pending.length > 0 && guard < nasAll.length + 100) {
      guard += 1;
      const still: typeof nasAll = [];
      for (const n of pending) {
        const parentIfrs =
          n.parentId == null ? null : nasIdToIfrsId.get(n.parentId);
        if (n.parentId != null && parentIfrs == null) {
          still.push(n);
          continue;
        }
        const row = await db.account.create({
          data: {
            organizationId,
            accountingBookId: ifrsBook.id,
            code: n.code,
            nameAz: n.nameAz,
            nameRu: n.nameRu,
            nameEn: n.nameEn,
            type: n.type,
            currency: n.currency,
            ledgerType: LedgerType.IFRS,
            parentId: parentIfrs,
          },
        });
        nasIdToIfrsId.set(n.id, row.id);
        ifrsByCode.set(n.code, row);
        created += 1;
      }
      if (still.length === pending.length) {
        throw new BadRequestException(
          "IFRS mirror: не удалось разрешить иерархию parentId",
        );
      }
      pending = still;
    }

    return {
      created,
      warning:
        "Ops clone of NAS→IFRS codes. Prefer TemplateIFRSMapping provision for production IFRS CoA.",
    };
  }

  /**
   * P1: provision IFRS CoA from TemplateIFRSMapping (+ JSON MVP overrides fallback),
   * seed/publish LedgerMappingSet. Does NOT clone full NAS chart.
   * Skipped when org lacks ifrs_mapping entitlement (chart UI can provision later).
   */
  async bootstrapMultiGaapForNewOrganization(
    organizationId: string,
    db: AccountsDb = this.prisma,
  ): Promise<{ skipped: boolean; ifrsCreated?: number; mappingPairs?: number }> {
    const entitled = await this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.IFRS_MAPPING,
    );
    await this.accountingBooks?.ensureSystemBooks(
      organizationId,
      { createIfrs: entitled },
      db,
    );
    if (!entitled) {
      return { skipped: true };
    }
    const out = await this.provisionIfrsFromTemplate(organizationId, db);
    return { skipped: false, ...out };
  }

  async provisionIfrsFromTemplate(
    organizationId: string,
    db: AccountsDb = this.prisma,
  ): Promise<{ ifrsCreated: number; mappingPairs: number }> {
    const entitled = await this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.IFRS_MAPPING,
    );
    if (!entitled) {
      throw new ForbiddenException(
        "ifrsMapping entitlement required to provision IFRS chart",
      );
    }
    const systemBooks = await this.accountingBooks?.ensureSystemBooks(
      organizationId,
      { createIfrs: true },
      db,
    );
    const ifrsBook = systemBooks?.ifrs;
    if (!ifrsBook) {
      throw new NotFoundException("Active IFRS accounting book not found");
    }
    const templateRows = await this.loadTemplateIfrsRows(db);
    const nasAccounts = await db.account.findMany({
      where: { organizationId, ledgerType: LedgerType.NAS, deletedAt: null },
      select: {
        id: true,
        code: true,
        type: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
        currency: true,
      },
    });
    const nasByCode = new Map(nasAccounts.map((a) => [a.code, a]));

    let ifrsCreated = 0;
    const pairs: Array<{
      sourceAccountId: string;
      targetAccountId: string;
      ratio?: Prisma.Decimal;
    }> = [];

    for (const row of templateRows) {
      const nas = nasByCode.get(row.nasCode);
      if (!nas) continue;

      let ifrs = await db.account.findFirst({
        where: {
          organizationId,
          ledgerType: LedgerType.IFRS,
          accountingBookId: ifrsBook.id,
          code: row.ifrsCode,
          deletedAt: null,
        },
      });
      if (!ifrs) {
        ifrs = await db.account.create({
          data: {
            organizationId,
            accountingBookId: ifrsBook.id,
            code: row.ifrsCode,
            nameAz: row.description || `${nas.nameAz} (IFRS)`,
            nameRu: row.description || `${nas.nameRu} (IFRS)`,
            nameEn: row.description || `${nas.nameEn} (IFRS)`,
            type: nas.type,
            currency: nas.currency,
            ledgerType: LedgerType.IFRS,
          },
        });
        ifrsCreated += 1;
      }
      pairs.push({
        sourceAccountId: nas.id,
        targetAccountId: ifrs.id,
        ratio: row.ratio,
      });
    }

    if (pairs.length > 0) {
      await this.ledgerMapping.bootstrapDraftFromAccountPairs(
        organizationId,
        pairs,
        db,
      );
    }

    return { ifrsCreated, mappingPairs: pairs.length };
  }

  async createIfrsAccount(
    organizationId: string,
    dto: {
      code: string;
      nameAz: string;
      nameRu?: string;
      nameEn?: string;
      type: AccountType;
      currency?: string;
      parentId?: string;
    },
  ) {
    const code = dto.code.trim();
    if (!code) throw new BadRequestException("code is required");
    const systemBooks = await this.accountingBooks?.ensureSystemBooks(
      organizationId,
      { createIfrs: true },
    );
    const ifrsBook = systemBooks?.ifrs;
    if (!ifrsBook) {
      throw new NotFoundException("Active IFRS accounting book not found");
    }
    const exists = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.IFRS,
        accountingBookId: ifrsBook.id,
        code,
      },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(`IFRS account ${code} already exists`);
    }
    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: {
          id: dto.parentId,
          organizationId,
          ledgerType: LedgerType.IFRS,
          accountingBookId: ifrsBook.id,
        },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException("IFRS parent account not found");
    }
    return this.prisma.account.create({
      data: {
        organizationId,
        accountingBookId: ifrsBook.id,
        code,
        nameAz: dto.nameAz.trim(),
        nameRu: (dto.nameRu ?? dto.nameAz).trim(),
        nameEn: (dto.nameEn ?? dto.nameAz).trim(),
        type: dto.type,
        currency: dto.currency ?? "AZN",
        ledgerType: LedgerType.IFRS,
        parentId: dto.parentId ?? null,
      },
    });
  }

  private async loadTemplateIfrsRows(
    db: AccountsDb,
  ): Promise<
    Array<{
      nasCode: string;
      ifrsCode: string;
      ratio: Prisma.Decimal;
      description: string;
    }>
  > {
    const fromDb = await db.templateIFRSMapping.findMany({
      orderBy: { nasCode: "asc" },
    });
    if (fromDb.length > 0) {
      return fromDb.map((r) => ({
        nasCode: r.nasCode,
        ifrsCode: r.ifrsCode,
        ratio: r.ratio,
        description: r.description,
      }));
    }
    // Fallback MVP overrides (keep in sync with template-ifrs-mapping.v1.json)
    return [
      { nasCode: "211", ifrsCode: "1200", ratio: new Decimal(1), description: "Trade receivables (IFRS MVP)" },
      { nasCode: "601", ifrsCode: "4000", ratio: new Decimal(1), description: "Revenue (IFRS MVP)" },
      { nasCode: "221", ifrsCode: "1100", ratio: new Decimal(1), description: "Cash at bank (IFRS MVP)" },
      { nasCode: "101", ifrsCode: "1000", ratio: new Decimal(1), description: "Cash on hand (IFRS MVP)" },
      { nasCode: "531", ifrsCode: "2100", ratio: new Decimal(1), description: "Trade payables (IFRS MVP)" },
      { nasCode: "701", ifrsCode: "5000", ratio: new Decimal(1), description: "Cost of sales (IFRS MVP)" },
      { nasCode: "721", ifrsCode: "5100", ratio: new Decimal(1), description: "Operating expenses (IFRS MVP)" },
    ];
  }

  listMappings(organizationId: string) {
    return this.prisma.accountMapping.findMany({
      where: { organizationId },
      include: {
        nasAccount: {
          select: {
            id: true,
            code: true,
            nameAz: true,
            nameRu: true,
            nameEn: true,
            ledgerType: true,
          },
        },
        ifrsAccount: {
          select: {
            id: true,
            code: true,
            nameAz: true,
            nameRu: true,
            nameEn: true,
            ledgerType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createMapping(
    _organizationId: string,
    _dto: CreateAccountMappingDto,
  ): Promise<never> {
    throw new GoneException({
      code: "LEGACY_MAPPING_GONE",
      message:
        "Legacy AccountMapping writes are closed. Use /api/accounting/ledger-mappings",
    });
  }

  async deleteMapping(_organizationId: string, _id: string): Promise<never> {
    throw new GoneException({
      code: "LEGACY_MAPPING_GONE",
      message:
        "Legacy AccountMapping writes are closed. Use /api/accounting/ledger-mappings",
    });
  }

  listIfrsMappingRules(organizationId: string) {
    return this.prisma.ifrsMappingRule.findMany({
      where: { organizationId },
      orderBy: [
        { sourceNasAccountCode: "asc" },
        { targetIfrsAccountCode: "asc" },
      ],
    });
  }

  async createIfrsMappingRule(
    _organizationId: string,
    _dto: CreateIfrsMappingRuleDto,
  ): Promise<never> {
    throw new GoneException({
      code: "LEGACY_MAPPING_GONE",
      message:
        "Legacy IfrsMappingRule writes are closed. Use /api/accounting/ledger-mappings",
    });
  }

  async updateIfrsMappingRule(
    _organizationId: string,
    _id: string,
    _dto: UpdateIfrsMappingRuleDto,
  ): Promise<never> {
    throw new GoneException({
      code: "LEGACY_MAPPING_GONE",
      message:
        "Legacy IfrsMappingRule writes are closed. Use /api/accounting/ledger-mappings",
    });
  }

  async deleteIfrsMappingRule(
    _organizationId: string,
    _id: string,
  ): Promise<never> {
    throw new GoneException({
      code: "LEGACY_MAPPING_GONE",
      message:
        "Legacy IfrsMappingRule writes are closed. Use /api/accounting/ledger-mappings",
    });
  }

  async createBankAccount(organizationId: string, dto: CreateBankAccountDto) {
    const code = dto.code.trim();
    const name = dto.name.trim();
    if (!code || !name) {
      throw new BadRequestException("code and name are required");
    }
    const mainBank = await this.posting.resolveAccountCode(organizationId, "MAIN_BANK");
    const bankPrefix = `${mainBank}.`;
    if (!code.startsWith(bankPrefix)) {
      throw new BadRequestException(`code must start with ${bankPrefix}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.accountingBooks?.ensureSystemBooks(organizationId, {}, tx);
      const nasBook = this.accountingBooks
        ? await this.accountingBooks.resolveByLedgerType(
            organizationId,
            LedgerType.NAS,
            tx,
          )
        : null;
      if (!nasBook) {
        throw new NotFoundException("Active NAS accounting book not found");
      }

      const exists = await tx.account.findFirst({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountingBookId: nasBook.id,
          code,
        },
        select: { id: true },
      });
      if (exists) {
        throw new BadRequestException("Account code already exists");
      }

      const parent = await tx.account.findFirst({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountingBookId: nasBook.id,
          code: mainBank,
        },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException(`Parent bank account ${mainBank} not found`);
      }

      return tx.account.create({
        data: {
          organizationId,
          accountingBookId: nasBook.id,
          ledgerType: LedgerType.NAS,
          code,
          nameAz: name,
          nameRu: name,
          nameEn: name,
          type: AccountType.ASSET,
          currency: dto.currency ?? "AZN",
          parentId: parent.id,
        },
        select: {
          id: true,
          code: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          currency: true,
          ledgerType: true,
        },
      });
    });
  }
}
