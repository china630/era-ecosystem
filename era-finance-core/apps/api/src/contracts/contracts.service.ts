import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContractStatus,
  Decimal,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { CreateContractDto } from "./dto/create-contract.dto";
import { PatchContractDto } from "./dto/patch-contract.dto";

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async checkLimit(contractId: string, amount: number | Decimal) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { commitments: true },
    });
    if (!contract) throw new NotFoundException("Contract not found");

    const requested = new Decimal(amount.toString());
    const committed = contract.commitments.reduce(
      (sum, c) => sum.add(c.amount),
      new Decimal(0),
    );

    if (contract.amountLimit == null) {
      return {
        allowed: true,
        limit: null,
        committed: committed.toFixed(4),
        remaining: null,
        requested: requested.toFixed(4),
      };
    }

    const limit = new Decimal(contract.amountLimit);
    const remaining = limit.sub(committed);
    const allowed = remaining.gte(requested);

    return {
      allowed,
      limit: limit.toFixed(4),
      committed: committed.toFixed(4),
      remaining: remaining.toFixed(4),
      requested: requested.toFixed(4),
    };
  }

  /** Records contract commitment against a posted document (purchase invoice, PO, etc.). */
  async documentUsage(
    organizationId: string,
    contractId: string,
    amount: number | Decimal,
    referenceType: string,
    referenceId: string,
  ) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId },
    });
    if (!contract) throw new NotFoundException("Contract not found");
    return this.prisma.contractCommitment.create({
      data: {
        contractId,
        amount: new Decimal(amount.toString()),
        referenceType,
        referenceId,
      },
    });
  }
}
