import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LedgerType, Prisma, SubcontoKind } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import type { PostTransactionLine } from "./accounting.service";
import {
  CreateAccountSubcontoConfigDto,
  CreateSubcontoTypeDto,
  UpdateAccountSubcontoConfigDto,
  UpdateSubcontoTypeDto,
} from "./dto/subconto.dto";

export type ResolvedDimension = {
  subcontoTypeId: string;
  valueId?: string | null;
  valueRef?: string | null;
};

const SYSTEM_SUBCONTO_TYPES: Array<{
  code: string;
  name: string;
  kind: SubcontoKind;
}> = [
  { code: "COUNTERPARTY", name: "Counterparty", kind: SubcontoKind.COUNTERPARTY },
  { code: "COST_CENTER", name: "Cost center", kind: SubcontoKind.COST_CENTER },
  { code: "EMPLOYEE", name: "Employee", kind: SubcontoKind.EMPLOYEE },
  { code: "PROJECT", name: "Project", kind: SubcontoKind.PROJECT },
  { code: "ITEM", name: "Item", kind: SubcontoKind.ITEM },
  { code: "BRANCH", name: "Branch (Poçt / Rabitə / Teleötürücü)", kind: SubcontoKind.CUSTOM },
];

/** Canonical valueRef codes for BRANCH multi-branch (one org, segment analytics). */
export const BRANCH_VALUE_REFS = [
  { code: "POCT", nameAz: "Poçt", nameRu: "Почта", nameEn: "Post" },
  { code: "RABITE", nameAz: "Rabitə", nameRu: "Связь", nameEn: "Telecom" },
  {
    code: "TELE",
    nameAz: "Teleötürücü",
    nameRu: "Телепередача",
    nameEn: "Broadcast",
  },
] as const;

/**
 * Flexible subconto (analytical dimensions on journal entry lines).
 * Posting write/validation is gated by ERA_SUBCONTO_ENABLED; config CRUD is always available.
 *
 * Callers that rely on auto-map from Transaction header fields (no explicit dimensions[]):
 * - invoices / finance payments (counterpartyId)
 * - netting, purchases, sales recognition
 * - depreciation, payroll (departmentId when set on transaction)
 * - kassa, banking, manufacturing, grant receipts
 */
@Injectable()
export class SubcontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return (
      (this.config.get<string>("ERA_SUBCONTO_ENABLED") ?? "false").toLowerCase() ===
      "true"
    );
  }

  getFeatureStatus() {
    return { enabled: this.isEnabled() };
  }

  async listTypes(organizationId: string) {
    return this.prisma.subcontoType.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    });
  }

  async createType(organizationId: string, dto: CreateSubcontoTypeDto) {
    const code = dto.code.trim().toUpperCase();
    return this.prisma.subcontoType.create({
      data: {
        organizationId,
        code,
        name: dto.name.trim(),
        kind: dto.kind,
        isSystem: false,
      },
    });
  }

  async updateType(
    organizationId: string,
    id: string,
    dto: UpdateSubcontoTypeDto,
  ) {
    const row = await this.prisma.subcontoType.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Subconto type not found");
    if (row.isSystem && dto.name == null) {
      throw new BadRequestException("System subconto types cannot be renamed to empty");
    }
    return this.prisma.subcontoType.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
      },
    });
  }

  async deleteType(organizationId: string, id: string) {
    const row = await this.prisma.subcontoType.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Subconto type not found");
    if (row.isSystem) {
      throw new BadRequestException("System subconto types cannot be deleted");
    }
    await this.prisma.subcontoType.delete({ where: { id } });
    return { deleted: true };
  }

  async listAccountConfigs(organizationId: string, accountId?: string) {
    return this.prisma.accountSubcontoConfig.findMany({
      where: {
        organizationId,
        ...(accountId ? { accountId } : {}),
      },
      include: {
        subcontoType: true,
        account: { select: { id: true, code: true, nameEn: true, nameRu: true } },
      },
      orderBy: [{ accountId: "asc" }, { sortOrder: "asc" }],
    });
  }

  async createAccountConfig(
    organizationId: string,
    dto: CreateAccountSubcontoConfigDto,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, organizationId, ledgerType: LedgerType.NAS },
    });
    if (!account) throw new NotFoundException("NAS account not found");

    const subcontoType = await this.prisma.subcontoType.findFirst({
      where: { id: dto.subcontoTypeId, organizationId },
    });
    if (!subcontoType) throw new NotFoundException("Subconto type not found");

    const count = await this.prisma.accountSubcontoConfig.count({
      where: { accountId: dto.accountId },
    });
    if (count >= 3) {
      throw new BadRequestException("At most 3 subconto types per account");
    }

    return this.prisma.accountSubcontoConfig.create({
      data: {
        organizationId,
        accountId: dto.accountId,
        subcontoTypeId: dto.subcontoTypeId,
        sortOrder: dto.sortOrder,
        required: dto.required ?? false,
      },
      include: { subcontoType: true },
    });
  }

  async updateAccountConfig(
    organizationId: string,
    id: string,
    dto: UpdateAccountSubcontoConfigDto,
  ) {
    const row = await this.prisma.accountSubcontoConfig.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Account subconto config not found");
    return this.prisma.accountSubcontoConfig.update({
      where: { id },
      data: {
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.required != null ? { required: dto.required } : {}),
      },
      include: { subcontoType: true },
    });
  }

  async deleteAccountConfig(organizationId: string, id: string) {
    const row = await this.prisma.accountSubcontoConfig.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Account subconto config not found");
    await this.prisma.accountSubcontoConfig.delete({ where: { id } });
    return { deleted: true };
  }

  async seedSystemTypes(organizationId: string) {
    const created: string[] = [];
    const existing: string[] = [];
    for (const spec of SYSTEM_SUBCONTO_TYPES) {
      const found = await this.prisma.subcontoType.findUnique({
        where: { organizationId_code: { organizationId, code: spec.code } },
      });
      if (found) {
        existing.push(spec.code);
        continue;
      }
      await this.prisma.subcontoType.create({
        data: {
          organizationId,
          code: spec.code,
          name: spec.name,
          kind: spec.kind,
          isSystem: true,
        },
      });
      created.push(spec.code);
    }
    return { created, existing };
  }

  /** Seed BRANCH type + return documented valueRef catalog (Poçt/Rabitə/Teleötürücü). */
  async seedBranchType(organizationId: string) {
    const existing = await this.prisma.subcontoType.findUnique({
      where: { organizationId_code: { organizationId, code: "BRANCH" } },
    });
    if (existing) {
      return { created: false, type: existing, valueRefs: BRANCH_VALUE_REFS };
    }
    const type = await this.prisma.subcontoType.create({
      data: {
        organizationId,
        code: "BRANCH",
        name: "Branch (Poçt / Rabitə / Teleötürücü)",
        kind: SubcontoKind.CUSTOM,
        isSystem: true,
      },
    });
    return { created: true, type, valueRefs: BRANCH_VALUE_REFS };
  }

  listBranchValueRefs() {
    return BRANCH_VALUE_REFS;
  }

  /** Idempotent backfill: Transaction.counterpartyId / departmentId → JournalEntryDimension. */
  async backfillFromTransactions(organizationId: string) {
    if (!this.isEnabled()) {
      throw new BadRequestException(
        "ERA_SUBCONTO_ENABLED must be true to run dimension backfill",
      );
    }

    const configs = await this.prisma.accountSubcontoConfig.findMany({
      where: { organizationId },
      include: { subcontoType: true },
    });
    if (configs.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const byAccount = new Map<string, typeof configs>();
    for (const c of configs) {
      const list = byAccount.get(c.accountId) ?? [];
      list.push(c);
      byAccount.set(c.accountId, list);
    }

    let created = 0;
    let skipped = 0;

    for (const [accountId, accountConfigs] of byAccount) {
      const cpConfig = accountConfigs.find(
        (c) => c.subcontoType.kind === SubcontoKind.COUNTERPARTY,
      );
      const ccConfig = accountConfigs.find(
        (c) => c.subcontoType.kind === SubcontoKind.COST_CENTER,
      );
      if (!cpConfig && !ccConfig) continue;

      const entries = await this.prisma.journalEntry.findMany({
        where: {
          organizationId,
          accountId,
          ledgerType: LedgerType.NAS,
          transaction: {
            OR: [
              ...(cpConfig ? [{ counterpartyId: { not: null } }] : []),
              ...(ccConfig ? [{ departmentId: { not: null } }] : []),
            ],
          },
        },
        select: {
          id: true,
          transaction: { select: { counterpartyId: true, departmentId: true } },
        },
        take: 50_000,
      });

      for (const entry of entries) {
        const tx = entry.transaction;
        if (cpConfig && tx.counterpartyId) {
          const exists = await this.prisma.journalEntryDimension.findFirst({
            where: {
              journalEntryId: entry.id,
              subcontoTypeId: cpConfig.subcontoTypeId,
            },
          });
          if (exists) {
            skipped += 1;
          } else {
            await this.prisma.journalEntryDimension.create({
              data: {
                journalEntryId: entry.id,
                subcontoTypeId: cpConfig.subcontoTypeId,
                valueId: tx.counterpartyId,
              },
            });
            created += 1;
          }
        }
        if (ccConfig && tx.departmentId) {
          const exists = await this.prisma.journalEntryDimension.findFirst({
            where: {
              journalEntryId: entry.id,
              subcontoTypeId: ccConfig.subcontoTypeId,
            },
          });
          if (exists) {
            skipped += 1;
          } else {
            await this.prisma.journalEntryDimension.create({
              data: {
                journalEntryId: entry.id,
                subcontoTypeId: ccConfig.subcontoTypeId,
                valueId: tx.departmentId,
              },
            });
            created += 1;
          }
        }
      }
    }

    return { created, skipped };
  }

  /**
   * Resolve and persist dimensions for posted journal lines (called from postJournalInTransaction).
   */
  async applyDimensionsToJournalEntries(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      journalEntries: Array<{
        journalEntryId: string;
        accountId: string;
        line: PostTransactionLine;
      }>;
      counterpartyId?: string | null;
      departmentId?: string | null;
    },
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const { organizationId, journalEntries, counterpartyId, departmentId } =
      params;
    if (journalEntries.length === 0) return;

    const accountIds = [...new Set(journalEntries.map((e) => e.accountId))];
    const configs = await tx.accountSubcontoConfig.findMany({
      where: { organizationId, accountId: { in: accountIds } },
      include: { subcontoType: true },
    });
    const configsByAccount = new Map<string, typeof configs>();
    for (const c of configs) {
      const list = configsByAccount.get(c.accountId) ?? [];
      list.push(c);
      configsByAccount.set(c.accountId, list);
    }

    const typesByKind = await tx.subcontoType.findMany({
      where: {
        organizationId,
        kind: { in: [SubcontoKind.COUNTERPARTY, SubcontoKind.COST_CENTER] },
      },
    });
    const counterpartyType = typesByKind.find(
      (t) => t.kind === SubcontoKind.COUNTERPARTY,
    );
    const costCenterType = typesByKind.find(
      (t) => t.kind === SubcontoKind.COST_CENTER,
    );

    for (const entry of journalEntries) {
      const accountConfigs = configsByAccount.get(entry.accountId) ?? [];
      if (accountConfigs.length === 0) continue;

      const explicit = new Map<string, ResolvedDimension>();
      for (const dim of entry.line.dimensions ?? []) {
        explicit.set(dim.subcontoTypeId, dim);
      }

      const resolved: ResolvedDimension[] = [];

      for (const cfg of accountConfigs) {
        let dim = explicit.get(cfg.subcontoTypeId);
        if (!dim) {
          if (
            cfg.subcontoType.kind === SubcontoKind.COUNTERPARTY &&
            counterpartyId &&
            counterpartyType?.id === cfg.subcontoTypeId
          ) {
            dim = { subcontoTypeId: cfg.subcontoTypeId, valueId: counterpartyId };
          } else if (
            cfg.subcontoType.kind === SubcontoKind.COST_CENTER &&
            departmentId &&
            costCenterType?.id === cfg.subcontoTypeId
          ) {
            dim = { subcontoTypeId: cfg.subcontoTypeId, valueId: departmentId };
          }
        }
        if (cfg.required && !dim?.valueId && !dim?.valueRef) {
          throw new BadRequestException(
            `Account requires subconto "${cfg.subcontoType.code}" but no value provided`,
          );
        }
        if (dim) {
          resolved.push(dim);
        }
      }

      for (const dim of resolved) {
        await tx.journalEntryDimension.create({
          data: {
            journalEntryId: entry.journalEntryId,
            subcontoTypeId: dim.subcontoTypeId,
            valueId: dim.valueId ?? null,
            valueRef: dim.valueRef ?? null,
          },
        });
      }
    }
  }

  async copyDimensionsToMirroredEntry(
    tx: Prisma.TransactionClient,
    sourceJournalEntryId: string,
    targetJournalEntryId: string,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    const dims = await tx.journalEntryDimension.findMany({
      where: { journalEntryId: sourceJournalEntryId },
    });
    for (const dim of dims) {
      await tx.journalEntryDimension.create({
        data: {
          journalEntryId: targetJournalEntryId,
          subcontoTypeId: dim.subcontoTypeId,
          valueId: dim.valueId,
          valueRef: dim.valueRef,
        },
      });
    }
  }
}
