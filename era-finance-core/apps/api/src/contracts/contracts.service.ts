import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  ContractAmendmentStatus,
  ContractRole,
  ContractStatus,
  Decimal,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { CronModuleGateService } from "../subscription/cron-module-gate.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { bakuCivilUtcDate, todayBakuYmd } from "../billing/baku-billing.util";
import { normalizeListPagination } from "../common/list-pagination";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { CreateContractDto } from "./dto/create-contract.dto";
import { PatchContractDto } from "./dto/patch-contract.dto";
import {
  CreateAmendmentDto,
  ReplaceContractLinesDto,
} from "./dto/create-amendment.dto";

export type ContractLimitCheckResult = {
  allowed: boolean;
  reason: string | null;
  limit: string | null;
  committed: string;
  remaining: string | null;
  requested: string;
  status?: ContractStatus;
  dateTo?: string | null;
};

function todayBakuDateOnly(): Date {
  return bakuCivilUtcDate(todayBakuYmd());
}

function toDateOnlyUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronGate: CronModuleGateService,
  ) {}

  async list(
    organizationId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        orderBy: [{ number: "asc" }],
        skip,
        take: pageSize,
        include: {
          counterparty: { select: { id: true, nameCipher: true } },
          _count: { select: { commitments: true, lines: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(organizationId: string, dto: CreateContractDto) {
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: dto.counterpartyId, organizationId },
    });
    if (!cp) throw new NotFoundException("Counterparty not found");

    const dateFrom = dto.dateFrom ? parseIsoDateOnly(dto.dateFrom) : null;
    const dateTo = dto.dateTo ? parseIsoDateOnly(dto.dateTo) : null;
    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }

    return this.prisma.contract.create({
      data: {
        organizationId,
        counterpartyId: dto.counterpartyId,
        number: dto.number.trim(),
        type: dto.type,
        contractRole: dto.contractRole ?? ContractRole.PRIME,
        currency: dto.currency ?? "AZN",
        amountLimit:
          dto.amountLimit != null ? new Decimal(dto.amountLimit) : null,
        dateFrom,
        dateTo,
        description: dto.description?.trim() ?? null,
        lines: dto.lines?.length
          ? {
              create: dto.lines.map((line, idx) => ({
                description: line.description?.trim() ?? null,
                code: line.code?.trim() ?? null,
                sortOrder: line.sortOrder ?? idx,
                quantity:
                  line.quantity != null ? new Decimal(line.quantity) : null,
                unitPrice:
                  line.unitPrice != null ? new Decimal(line.unitPrice) : null,
                amount: line.amount != null ? new Decimal(line.amount) : null,
              })),
            }
          : undefined,
      },
      include: { lines: true, counterparty: { select: { id: true, nameCipher: true } } },
    });
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.contract.findFirst({
      where: { id, organizationId },
      include: {
        counterparty: { select: { id: true, nameCipher: true, taxIdCipher: true } },
        lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        commitments: { orderBy: { createdAt: "desc" }, take: 50 },
        amendments: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!row) throw new NotFoundException("Contract not found");
    return row;
  }

  async patch(organizationId: string, id: string, dto: PatchContractDto) {
    await this.get(organizationId, id);

    const dateFrom =
      dto.dateFrom === undefined
        ? undefined
        : dto.dateFrom == null
          ? null
          : parseIsoDateOnly(dto.dateFrom);
    const dateTo =
      dto.dateTo === undefined
        ? undefined
        : dto.dateTo == null
          ? null
          : parseIsoDateOnly(dto.dateTo);

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.type != null ? { type: dto.type } : {}),
        ...(dto.contractRole != null ? { contractRole: dto.contractRole } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.currency != null ? { currency: dto.currency } : {}),
        ...(dto.amountLimit !== undefined
          ? {
              amountLimit:
                dto.amountLimit == null ? null : new Decimal(dto.amountLimit),
            }
          : {}),
        ...(dateFrom !== undefined ? { dateFrom } : {}),
        ...(dateTo !== undefined ? { dateTo } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
      },
      include: { lines: true, amendments: true },
    });
  }

  async replaceLines(
    organizationId: string,
    id: string,
    lines: ReplaceContractLinesDto[],
  ) {
    await this.get(organizationId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.contractLine.deleteMany({ where: { contractId: id } });
      if (lines.length) {
        await tx.contractLine.createMany({
          data: lines.map((line, idx) => ({
            contractId: id,
            description: line.description?.trim() ?? null,
            code: line.code?.trim() ?? null,
            sortOrder: line.sortOrder ?? idx,
            quantity: line.quantity != null ? new Decimal(line.quantity) : null,
            unitPrice:
              line.unitPrice != null ? new Decimal(line.unitPrice) : null,
            amount: line.amount != null ? new Decimal(line.amount) : null,
          })),
        });
      }
      return tx.contract.findFirstOrThrow({
        where: { id, organizationId },
        include: {
          lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          amendments: { orderBy: { createdAt: "desc" } },
        },
      });
    });
  }

  async createAmendment(
    organizationId: string,
    contractId: string,
    dto: CreateAmendmentDto,
  ) {
    const contract = await this.get(organizationId, contractId);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("Amendments require an ACTIVE contract");
    }
    if (dto.sourceType && dto.sourceId) {
      const dup = await this.prisma.contractAmendment.findFirst({
        where: {
          organizationId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
      });
      if (dup) {
        throw new BadRequestException({
          code: "AMENDMENT_SOURCE_DUPLICATE",
          message: "Amendment already exists for this source",
          amendmentId: dup.id,
        });
      }
    }
    return this.prisma.contractAmendment.create({
      data: {
        organizationId,
        contractId,
        number: dto.number.trim(),
        amountLimitDelta:
          dto.amountLimitDelta != null
            ? new Decimal(dto.amountLimitDelta)
            : null,
        dateTo: dto.dateTo ? parseIsoDateOnly(dto.dateTo) : null,
        description: dto.description?.trim() ?? null,
        sourceType: dto.sourceType?.trim() ?? null,
        sourceId: dto.sourceId?.trim() ?? null,
        status: ContractAmendmentStatus.DRAFT,
      },
    });
  }

  /**
   * Seed Contract SOV from an approved Construction estimate pack (no GL).
   * Idempotent on commitment `construction_estimate` + packageId.
   * Skips when SOV already has manual lines (no prior estimate seed).
   */
  async seedSovFromEstimatePackage(input: {
    organizationId: string;
    contractId: string;
    packageId: string;
    version: number;
    amountNet: number;
    lines: Array<{
      itemCode: string;
      description: string;
      qty: number;
      amountNet: number;
    }>;
  }) {
    const REF_TYPE = "construction_estimate";
    const contract = await this.prisma.contract.findFirst({
      where: { id: input.contractId, organizationId: input.organizationId },
      include: {
        lines: { select: { id: true } },
        commitments: {
          where: { referenceType: REF_TYPE },
          select: { id: true, referenceId: true },
        },
      },
    });
    if (!contract) {
      return { seeded: false, idempotent: false, skipped: "CONTRACT_NOT_FOUND" as const };
    }

    const samePack = contract.commitments.find(
      (c) => c.referenceId === input.packageId,
    );
    if (samePack) {
      return {
        seeded: false,
        idempotent: true,
        skipped: null,
        lineCount: contract.lines.length,
      };
    }

    const priorEstimateSeed = contract.commitments[0] ?? null;
    if (contract.lines.length > 0 && !priorEstimateSeed) {
      return {
        seeded: false,
        idempotent: false,
        skipped: "SOV_NONEMPTY_MANUAL" as const,
        lineCount: contract.lines.length,
      };
    }

    if (!input.lines.length) {
      return { seeded: false, idempotent: false, skipped: "EMPTY_LINES" as const };
    }

    const sovLines: ReplaceContractLinesDto[] = input.lines.map((line, idx) => {
      const qty = Number(line.qty);
      const amount = Number(line.amountNet);
      const unitPrice = qty > 0 ? amount / qty : amount;
      return {
        code: line.itemCode,
        description: line.description,
        sortOrder: idx,
        quantity: qty,
        unitPrice,
        amount,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      if (priorEstimateSeed) {
        await tx.contractCommitment.deleteMany({
          where: { contractId: input.contractId, referenceType: REF_TYPE },
        });
      }
      await tx.contractLine.deleteMany({ where: { contractId: input.contractId } });
      await tx.contractLine.createMany({
        data: sovLines.map((line, idx) => ({
          contractId: input.contractId,
          description: line.description?.trim() ?? null,
          code: line.code?.trim() ?? null,
          sortOrder: line.sortOrder ?? idx,
          quantity: line.quantity != null ? new Decimal(line.quantity) : null,
          unitPrice: line.unitPrice != null ? new Decimal(line.unitPrice) : null,
          amount: line.amount != null ? new Decimal(line.amount) : null,
        })),
      });
      await tx.contractCommitment.create({
        data: {
          contractId: input.contractId,
          amount: new Decimal(input.amountNet),
          referenceType: REF_TYPE,
          referenceId: input.packageId,
        },
      });
      if (contract.amountLimit == null) {
        await tx.contract.update({
          where: { id: input.contractId },
          data: { amountLimit: new Decimal(input.amountNet) },
        });
      }
      return {
        seeded: true,
        idempotent: false,
        skipped: null,
        lineCount: sovLines.length,
        version: input.version,
      };
    });
  }

  /**
   * Draft amendment from construction change-request event (idempotent on source).
   */
  async draftAmendmentFromChangeRequest(input: {
    organizationId: string;
    contractId: string;
    changeRequestId: string;
    amountLimitDelta?: number | null;
    description?: string | null;
  }) {
    const existing = await this.prisma.contractAmendment.findFirst({
      where: {
        organizationId: input.organizationId,
        sourceType: "change_request",
        sourceId: input.changeRequestId,
      },
    });
    if (existing) return { amendment: existing, idempotent: true };

    const contract = await this.prisma.contract.findFirst({
      where: { id: input.contractId, organizationId: input.organizationId },
    });
    if (!contract || contract.status !== ContractStatus.ACTIVE) {
      return { amendment: null, idempotent: false, skipped: "CONTRACT_NOT_ACTIVE" };
    }

    const amendment = await this.prisma.contractAmendment.create({
      data: {
        organizationId: input.organizationId,
        contractId: input.contractId,
        number: `CR-${input.changeRequestId.slice(0, 8)}`,
        amountLimitDelta:
          input.amountLimitDelta != null
            ? new Decimal(input.amountLimitDelta)
            : null,
        description:
          input.description?.trim() ??
          `Ops change request ${input.changeRequestId}`,
        sourceType: "change_request",
        sourceId: input.changeRequestId,
        status: ContractAmendmentStatus.DRAFT,
      },
    });
    return { amendment, idempotent: false };
  }

  async activateAmendment(organizationId: string, amendmentId: string) {
    const amd = await this.prisma.contractAmendment.findFirst({
      where: { id: amendmentId, organizationId },
      include: { contract: { include: { commitments: true } } },
    });
    if (!amd) throw new NotFoundException("Amendment not found");
    if (amd.status !== ContractAmendmentStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT amendments can be activated");
    }
    if (amd.contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("Base contract must be ACTIVE");
    }

    const nextLimit =
      amd.amountLimitDelta != null
        ? new Decimal(amd.contract.amountLimit ?? 0).add(amd.amountLimitDelta)
        : amd.contract.amountLimit;

    if (nextLimit != null) {
      const committed = amd.contract.commitments.reduce(
        (sum, c) => sum.add(c.amount),
        new Decimal(0),
      );
      if (new Decimal(nextLimit).lt(committed)) {
        throw new BadRequestException({
          code: "AMENDMENT_BELOW_COMMITTED",
          message: "Activated limit would be below committed amount",
          committed: committed.toFixed(4),
          nextLimit: new Decimal(nextLimit).toFixed(4),
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: amd.contractId },
        data: {
          ...(amd.amountLimitDelta != null
            ? { amountLimit: nextLimit }
            : {}),
          ...(amd.dateTo != null ? { dateTo: amd.dateTo } : {}),
        },
      });
      return tx.contractAmendment.update({
        where: { id: amd.id },
        data: {
          status: ContractAmendmentStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });
    });
  }

  async activate(organizationId: string, id: string) {
    const row = await this.get(organizationId, id);
    if (row.status !== ContractStatus.DRAFT && row.status !== ContractStatus.SUSPENDED) {
      throw new BadRequestException("Only DRAFT or SUSPENDED contracts can be activated");
    }
    return this.prisma.contract.update({
      where: { id },
      data: { status: ContractStatus.ACTIVE },
    });
  }

  private evaluateLimit(
    contract: {
      status: ContractStatus;
      dateTo: Date | null;
      amountLimit: Decimal | null;
      commitments: { amount: Decimal }[];
    },
    amount: number | Decimal,
  ): ContractLimitCheckResult {
    const requested = new Decimal(amount.toString());
    const committed = contract.commitments.reduce(
      (sum, c) => sum.add(c.amount),
      new Decimal(0),
    );
    const dateToIso = contract.dateTo
      ? toDateOnlyUtc(contract.dateTo).toISOString().slice(0, 10)
      : null;

    if (contract.status !== ContractStatus.ACTIVE) {
      return {
        allowed: false,
        reason: "CONTRACT_NOT_ACTIVE",
        limit:
          contract.amountLimit != null
            ? new Decimal(contract.amountLimit).toFixed(4)
            : null,
        committed: committed.toFixed(4),
        remaining:
          contract.amountLimit != null
            ? new Decimal(contract.amountLimit).sub(committed).toFixed(4)
            : null,
        requested: requested.toFixed(4),
        status: contract.status,
        dateTo: dateToIso,
      };
    }

    if (contract.dateTo) {
        const today = todayBakuDateOnly();
      const end = toDateOnlyUtc(contract.dateTo);
      if (today.getTime() > end.getTime()) {
        return {
          allowed: false,
          reason: "CONTRACT_EXPIRED",
          limit:
            contract.amountLimit != null
              ? new Decimal(contract.amountLimit).toFixed(4)
              : null,
          committed: committed.toFixed(4),
          remaining:
            contract.amountLimit != null
              ? new Decimal(contract.amountLimit).sub(committed).toFixed(4)
              : null,
          requested: requested.toFixed(4),
          status: contract.status,
          dateTo: dateToIso,
        };
      }
    }

    if (contract.amountLimit == null) {
      return {
        allowed: true,
        reason: null,
        limit: null,
        committed: committed.toFixed(4),
        remaining: null,
        requested: requested.toFixed(4),
        status: contract.status,
        dateTo: dateToIso,
      };
    }

    const limit = new Decimal(contract.amountLimit);
    const remaining = limit.sub(committed);
    const allowed = remaining.gte(requested);

    return {
      allowed,
      reason: allowed ? null : "LIMIT_EXCEEDED",
      limit: limit.toFixed(4),
      committed: committed.toFixed(4),
      remaining: remaining.toFixed(4),
      requested: requested.toFixed(4),
      status: contract.status,
      dateTo: dateToIso,
    };
  }

  async checkLimit(
    contractId: string,
    amount: number | Decimal,
    organizationId?: string,
  ): Promise<ContractLimitCheckResult> {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { commitments: true },
    });
    if (!contract) throw new NotFoundException("Contract not found");
    return this.evaluateLimit(contract, amount);
  }

  /**
   * Atomically validates contract limit/status/expiry and creates a commitment
   * (mirrors gov-budget recordExpenseExecution commitment pattern).
   */
  async reserveCommitmentInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    contractId: string,
    amount: number | Decimal,
    referenceType: string,
    referenceId: string,
  ) {
    const contract = await tx.contract.findFirst({
      where: { id: contractId, organizationId },
      include: { commitments: true },
    });
    if (!contract) throw new NotFoundException("Contract not found");

    const check = this.evaluateLimit(contract, amount);
    if (!check.allowed) {
      throw new BadRequestException({
        code: check.reason ?? "CONTRACT_LIMIT_EXCEEDED",
        message: "Contract commitment not allowed",
        ...check,
      });
    }

    return tx.contractCommitment.create({
      data: {
        contractId,
        amount: new Decimal(amount.toString()),
        referenceType,
        referenceId,
      },
    });
  }

  /** Records contract commitment against a posted document (purchase invoice, PO, etc.). */
  async documentUsage(
    organizationId: string,
    contractId: string,
    amount: number | Decimal,
    referenceType: string,
    referenceId: string,
  ) {
    return this.prisma.$transaction(async (tx) =>
      this.reserveCommitmentInTransaction(
        tx,
        organizationId,
        contractId,
        amount,
        referenceType,
        referenceId,
      ),
    );
  }

  /** Sets ACTIVE contracts with dateTo &lt; today (UTC) to EXPIRED. */
  async expireOverdueContracts(): Promise<{ updated: number }> {
    const today = todayBakuDateOnly();
    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
    });
    let updated = 0;
    for (const { id: orgId } of orgs) {
      updated += await runWithTenantContextAsync(
        { organizationId: orgId, skipTenantFilter: false },
        async () => {
          const overdue = await this.prisma.contract.count({
            where: {
              organizationId: orgId,
              status: ContractStatus.ACTIVE,
              dateTo: { lt: today },
            },
          });
          if (overdue === 0) return 0;
          const on = await this.cronGate.isModuleOn(
            orgId,
            ModuleEntitlement.CONTRACT_MANAGEMENT_PRO,
          );
          if (!on) return 0;
          const result = await this.prisma.contract.updateMany({
            where: {
              organizationId: orgId,
              status: ContractStatus.ACTIVE,
              dateTo: { lt: today },
            },
            data: { status: ContractStatus.EXPIRED },
          });
          return result.count;
        },
      );
    }
    return { updated };
  }

  @Cron("15 1 * * *", { timeZone: "Asia/Baku" })
  async expireOverdueContractsCron(): Promise<void> {
    const { updated } = await this.expireOverdueContracts();
    if (updated > 0) {
      this.logger.log(`Expired ${updated} overdue contract(s)`);
    }
  }
}
