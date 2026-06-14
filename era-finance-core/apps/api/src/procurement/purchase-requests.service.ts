import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CounterpartyRole,
  Decimal,
  PurchaseRequestApprovalDecision,
  PurchaseRequestStatus,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import type { ApprovePurchaseRequestDto } from "./dto/approve-purchase-request.dto";
import type { CreatePurchaseRequestDto } from "./dto/create-purchase-request.dto";
import type { CreatePurchaseRequestLineDto } from "./dto/create-purchase-request-line.dto";
import type { UpdatePurchaseRequestDto } from "./dto/update-purchase-request.dto";

const EDITABLE_STATUSES = new Set<PurchaseRequestStatus>([
  PurchaseRequestStatus.DRAFT,
  PurchaseRequestStatus.SUBMITTED,
]);

const STATUS_TRANSITIONS: Partial<
  Record<PurchaseRequestStatus, PurchaseRequestStatus[]>
> = {
  [PurchaseRequestStatus.APPROVED]: [PurchaseRequestStatus.RFQ],
  [PurchaseRequestStatus.RFQ]: [PurchaseRequestStatus.ORDERED],
  [PurchaseRequestStatus.ORDERED]: [PurchaseRequestStatus.CLOSED],
};

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private includeDetail = {
    lines: { orderBy: { lineNo: "asc" as const } },
    department: { select: { id: true, name: true } },
    requesterUser: { select: { id: true, email: true } },
    preferredCounterparty: { select: { id: true, nameCipher: true } },
    approvals: {
      orderBy: { decidedAt: "desc" as const },
      include: {
        approverUser: { select: { id: true, email: true } },
      },
    },
  };

  async list(
    organizationId: string,
    opts?: { page?: number; pageSize?: number; status?: PurchaseRequestStatus },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = {
      organizationId,
      ...(opts?.status ? { status: opts.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { lines: true, approvals: true } },
        },
      }),
      this.prisma.purchaseRequest.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: { id, organizationId },
      include: this.includeDetail,
    });
    if (!row) throw new NotFoundException("Purchase request not found");
    return row;
  }

  private mapLines(lines: CreatePurchaseRequestLineDto[] | undefined) {
    if (!lines?.length) return undefined;
    return lines.map((line, index) => ({
      lineNo: line.lineNo ?? index + 1,
      description: line.description.trim(),
      quantity:
        line.quantity != null ? new Decimal(line.quantity) : null,
      unit: line.unit?.trim() ?? null,
      unitPrice:
        line.unitPrice != null ? new Decimal(line.unitPrice) : null,
      amount: line.amount != null ? new Decimal(line.amount) : null,
      productId: line.productId ?? null,
    }));
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `PR-${year}-`;
    const latest = await this.prisma.purchaseRequest.findFirst({
      where: {
        organizationId,
        number: { startsWith: prefix },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const seq = latest?.number
      ? Number.parseInt(latest.number.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }

  private async assertDepartment(organizationId: string, departmentId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId },
    });
    if (!dept) throw new NotFoundException("Department not found");
  }

  private async assertSupplierCounterparty(
    organizationId: string,
    counterpartyId: string,
  ) {
    const cp = await this.prisma.counterparty.findFirst({
      where: {
        id: counterpartyId,
        organizationId,
        role: { in: [CounterpartyRole.SUPPLIER, CounterpartyRole.BOTH] },
      },
    });
    if (!cp) {
      throw new BadRequestException("Preferred counterparty must be a supplier");
    }
  }

  async create(
    organizationId: string,
    requesterUserId: string,
    dto: CreatePurchaseRequestDto,
  ) {
    if (dto.departmentId) {
      await this.assertDepartment(organizationId, dto.departmentId);
    }
    if (dto.preferredCounterpartyId) {
      await this.assertSupplierCounterparty(
        organizationId,
        dto.preferredCounterpartyId,
      );
    }
    const number = dto.number?.trim() || (await this.nextNumber(organizationId));
    const neededByDate = dto.neededByDate
      ? new Date(`${dto.neededByDate}T00:00:00.000Z`)
      : null;
    const lines = this.mapLines(dto.lines);

    return this.prisma.purchaseRequest.create({
      data: {
        organizationId,
        requesterUserId,
        number,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        departmentId: dto.departmentId ?? null,
        neededByDate,
        preferredCounterpartyId: dto.preferredCounterpartyId ?? null,
        lines: lines?.length ? { create: lines } : undefined,
      },
      include: this.includeDetail,
    });
  }

  async update(organizationId: string, id: string, dto: UpdatePurchaseRequestDto) {
    const existing = await this.get(organizationId, id);

    if (dto.lines != null && !EDITABLE_STATUSES.has(existing.status)) {
      throw new BadRequestException(
        "Lines can only be edited in DRAFT or SUBMITTED status",
      );
    }

    if (
      dto.title != null ||
      dto.description !== undefined ||
      dto.departmentId !== undefined ||
      dto.neededByDate !== undefined
    ) {
      if (existing.status !== PurchaseRequestStatus.DRAFT) {
        throw new BadRequestException("Header fields editable only in DRAFT");
      }
    }

    if (dto.status != null && dto.status !== existing.status) {
      const allowed = STATUS_TRANSITIONS[existing.status];
      if (!allowed?.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from ${existing.status} to ${dto.status}`,
        );
      }
    }

    if (dto.departmentId) {
      await this.assertDepartment(organizationId, dto.departmentId);
    }
    if (dto.preferredCounterpartyId) {
      await this.assertSupplierCounterparty(
        organizationId,
        dto.preferredCounterpartyId,
      );
    }
    if (dto.purchaseTransactionId) {
      const tx = await this.prisma.transaction.findFirst({
        where: { id: dto.purchaseTransactionId, organizationId },
      });
      if (!tx) throw new NotFoundException("Purchase transaction not found");
    }

    const neededByDate =
      dto.neededByDate === undefined
        ? undefined
        : dto.neededByDate == null
          ? null
          : new Date(`${dto.neededByDate}T00:00:00.000Z`);

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines != null) {
        await tx.purchaseRequestLine.deleteMany({
          where: { purchaseRequestId: id },
        });
        const mapped = this.mapLines(dto.lines);
        if (mapped?.length) {
          await tx.purchaseRequestLine.createMany({
            data: mapped.map((line) => ({ ...line, purchaseRequestId: id })),
          });
        }
      }

      return tx.purchaseRequest.update({
        where: { id },
        data: {
          ...(dto.title != null ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() ?? null }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(neededByDate !== undefined ? { neededByDate } : {}),
          ...(dto.preferredCounterpartyId !== undefined
            ? { preferredCounterpartyId: dto.preferredCounterpartyId }
            : {}),
          ...(dto.purchaseTransactionId !== undefined
            ? { purchaseTransactionId: dto.purchaseTransactionId }
            : {}),
          ...(dto.status != null
            ? {
                status: dto.status,
                ...(dto.status === PurchaseRequestStatus.CLOSED
                  ? { closedAt: new Date() }
                  : {}),
              }
            : {}),
        },
        include: this.includeDetail,
      });
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT purchase requests can be deleted");
    }
    await this.prisma.purchaseRequest.delete({ where: { id } });
    return { ok: true };
  }

  async submit(organizationId: string, id: string) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT requests can be submitted");
    }
    if (!existing.lines.length) {
      throw new BadRequestException("At least one line is required to submit");
    }
    return this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: PurchaseRequestStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: this.includeDetail,
    });
  }

  async approve(
    organizationId: string,
    id: string,
    approverUserId: string,
    dto: ApprovePurchaseRequestDto,
  ) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== PurchaseRequestStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED requests can be approved");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.purchaseRequestApproval.create({
        data: {
          purchaseRequestId: id,
          approverUserId,
          decision: dto.decision,
          comment: dto.comment?.trim() ?? null,
        },
      });

      if (dto.decision === PurchaseRequestApprovalDecision.REJECTED) {
        return tx.purchaseRequest.update({
          where: { id },
          data: { status: PurchaseRequestStatus.DRAFT, submittedAt: null },
          include: this.includeDetail,
        });
      }

      return tx.purchaseRequest.update({
        where: { id },
        data: {
          status: PurchaseRequestStatus.APPROVED,
          approvedAt: new Date(),
        },
        include: this.includeDetail,
      });
    });
  }
}
