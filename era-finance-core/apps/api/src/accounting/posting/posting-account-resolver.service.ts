import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BankAccountType,
  LedgerType,
  OrganizationKind,
  Prisma,
  loadPostingRolesJson,
  type PostingRole,
} from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PostingAccountResolver {
  private templateCache = new Map<OrganizationKind, Map<PostingRole, string>>();

  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationKind(organizationId: string): Promise<OrganizationKind> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { kind: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org.kind;
  }

  private async loadTemplateMap(kind: OrganizationKind): Promise<Map<PostingRole, string>> {
    const cached = this.templateCache.get(kind);
    if (cached) return cached;

    const count = await this.prisma.templatePostingRole.count({ where: { kind } });
    let map: Map<PostingRole, string>;
    if (count > 0) {
      const rows = await this.prisma.templatePostingRole.findMany({ where: { kind } });
      map = new Map(rows.map((r) => [r.role as PostingRole, r.accountCode]));
    } else {
      const json = await loadPostingRolesJson(kind);
      map = new Map(Object.entries(json) as [PostingRole, string][]);
    }
    this.templateCache.set(kind, map);
    return map;
  }

  async resolveAccountCode(
    organizationId: string,
    role: PostingRole,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx ?? this.prisma;
    const org = await db.organization.findFirst({
      where: { id: organizationId },
      select: { kind: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const override = await db.organizationPostingRole.findUnique({
      where: {
        organizationId_role: { organizationId, role },
      },
    });
    if (override?.accountCode) {
      await this.assertAccountExists(organizationId, override.accountCode, db);
      return override.accountCode;
    }

    const template = await this.loadTemplateMap(org.kind);
    const code = template.get(role);
    if (!code) {
      throw new NotFoundException(`Posting role ${role} is not configured for kind ${org.kind}`);
    }
    return code;
  }

  async resolveMany(
    organizationId: string,
    roles: PostingRole[],
    tx?: Prisma.TransactionClient,
  ): Promise<Record<PostingRole, string>> {
    const out = {} as Record<PostingRole, string>;
    for (const role of roles) {
      out[role] = await this.resolveAccountCode(organizationId, role, tx);
    }
    return out;
  }

  /**
   * Resolve ƏDV deposit GL: prefer linked `VAT_DEPOSIT` bank account ledger code,
   * else posting role `VAT_DEPOSIT_ACCOUNT`.
   */
  async resolveVatDepositAccountCode(
    organizationId: string,
    tx?: Prisma.TransactionClient,
    bankAccountId?: string | null,
  ): Promise<string> {
    const db = tx ?? this.prisma;

    if (bankAccountId?.trim()) {
      const row = await db.organizationBankAccount.findFirst({
        where: {
          id: bankAccountId.trim(),
          organizationId,
          isArchived: false,
          deletedAt: null,
        },
        select: { ledgerAccountCode: true, accountType: true },
      });
      if (!row) {
        throw new NotFoundException("VAT deposit bank account not found");
      }
      if (row.accountType !== BankAccountType.VAT_DEPOSIT) {
        throw new BadRequestException(
          "bankAccountId must reference an organization bank account of type VAT_DEPOSIT",
        );
      }
      const code = row.ledgerAccountCode?.trim();
      if (!code) {
        throw new BadRequestException("VAT deposit bank account has no ledgerAccountCode");
      }
      await this.assertAccountExists(organizationId, code, db);
      return code;
    }

    const linked = await db.organizationBankAccount.findFirst({
      where: {
        organizationId,
        accountType: BankAccountType.VAT_DEPOSIT,
        isArchived: false,
        isFrozen: false,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { ledgerAccountCode: true },
    });
    const linkedCode = linked?.ledgerAccountCode?.trim();
    if (linkedCode) {
      await this.assertAccountExists(organizationId, linkedCode, db);
      return linkedCode;
    }

    return this.resolveAccountCode(organizationId, "VAT_DEPOSIT_ACCOUNT", tx);
  }

  /** COMMERCIAL preset codes (sync) for deprecated ledger.constants shim. */
  commercialPresetCode(role: PostingRole): string {
    const map = this.templateCache.get(OrganizationKind.COMMERCIAL);
    if (map?.has(role)) return map.get(role)!;
    const fallbacks: Partial<Record<PostingRole, string>> = {
      TRADE_RECEIVABLE: "211",
      SALES_REVENUE: "601",
      SUPPLIER_PAYABLE: "531",
      PAYROLL_EXPENSE: "721",
      PAYROLL_PAYABLE: "533",
      PAYROLL_TAX_PAYABLE: "521",
      PAYROLL_SOCIAL_PAYABLE: "523",
      SOCIAL_PAYABLE: "523",
      INVENTORY_GOODS: "201",
      COGS: "701",
      FX_GAIN: "662",
      FX_LOSS: "762",
      CASH_AZN: "101.01",
      CASH_FOREIGN: "102.01",
      CASH_IN_TRANSIT: "251",
      MAIN_BANK: "221",
      VAT_INPUT: "191",
      VAT_OUTPUT: "545",
      VAT_DEPOSIT_ACCOUNT: "223",
      ACCUMULATED_DEPRECIATION: "112",
      FINISHED_GOODS: "204",
      WIP_MANUFACTURING: "203",
      DEPRECIATION_EXPENSE: "713",
      MISC_OPERATING_EXPENSE: "731",
      MANUFACTURING_OVERHEAD_CREDIT: "741",
      INVENTORY_SURPLUS_INCOME: "631",
      FOUNDER_FUNDS: "561",
      ACCOUNTABLE_PERSONS: "244",
      TRANSIT_TRANSFER: "231",
      PREPAID_ASSET: "133",
      CHARTER_CAPITAL: "821",
      PERIOD_RESULT: "801",
      RETAINED_EARNINGS: "802",
      FIXED_ASSET_COST: "111",
      INTANGIBLE_ASSET: "131",
      ACCUMULATED_AMORTIZATION_INTANGIBLE: "132",
      REVALUATION_RESERVE: "811",
      ASSET_DISPOSAL_GAIN: "631",
      ASSET_DISPOSAL_LOSS: "731",
    };
    const code = fallbacks[role];
    if (!code) throw new NotFoundException(`Commercial preset missing for role ${role}`);
    return code;
  }

  private async assertAccountExists(
    organizationId: string,
    code: string,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    const acc = await db.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!acc) {
      throw new BadRequestException(
        `NAS account ${code} is not provisioned for this organization (posting role override)`,
      );
    }
  }

  warmCommercialTemplateCache(): void {
    void loadPostingRolesJson(OrganizationKind.COMMERCIAL).then((json) => {
      this.templateCache.set(
        OrganizationKind.COMMERCIAL,
        new Map(Object.entries(json) as [PostingRole, string][]),
      );
    });
  }
}
