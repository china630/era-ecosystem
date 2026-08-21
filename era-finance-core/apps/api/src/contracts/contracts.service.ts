import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  ContractStatus,
  Decimal,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CronModuleGateService } from "../subscription/cron-module-gate.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { normalizeListPagination } from "../common/list-pagination";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { CreateContractDto } from "./dto/create-contract.dto";
import { PatchContractDto } from "./dto/patch-contract.dto";

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

function utcTodayDateOnly(): Date {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
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
        currency: dto.currency ?? "AZN",
        amountLimit:
          dto.amountLimit != null ? new Decimal(dto.amountLimit) : null,
        dateFrom,
        dateTo,
        description: dto.description?.trim() ?? null,
        lines: dto.lines?.length
          ? {
              create: dto.lines.map((line) => ({
                description: line.description?.trim() ?? null,
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
        lines: true,
        commitments: { orderBy: { createdAt: "desc" }, take: 50 },
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
      include: { lines: true },
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
      const today = utcTodayDateOnly();
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
    const today = utcTodayDateOnly();
    const candidates = await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.ACTIVE,
        dateTo: { lt: today },
      },
      select: { id: true, organizationId: true },
    });
    const byOrg = new Map<string, string[]>();
    for (const row of candidates) {
      const list = byOrg.get(row.organizationId) ?? [];
      list.push(row.id);
      byOrg.set(row.organizationId, list);
    }
    let updated = 0;
    for (const [orgId, ids] of byOrg) {
      const on = await this.cronGate.isModuleOn(
        orgId,
        ModuleEntitlement.CONTRACT_MANAGEMENT_PRO,
      );
      if (!on) continue;
      const result = await this.prisma.contract.updateMany({
        where: { id: { in: ids }, status: ContractStatus.ACTIVE },
        data: { status: ContractStatus.EXPIRED },
      });
      updated += result.count;
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
