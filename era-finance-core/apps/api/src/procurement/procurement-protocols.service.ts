import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  ProcurementProtocolStatus,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import type {
  CreateBidDto,
  CreateProcurementProtocolDto,
  UpdateProcurementProtocolDto,
} from "./dto/procurement-protocol.dto";

@Injectable()
export class ProcurementProtocolsService {
  constructor(private readonly prisma: PrismaService) {}

  private includeDetail = {
    winnerCounterparty: { select: { id: true, nameCipher: true } },
    contract: { select: { id: true, number: true, status: true } },
    bids: {
      orderBy: { createdAt: "asc" as const },
      include: {
        counterparty: { select: { id: true, nameCipher: true } },
      },
    },
  };

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
      this.prisma.procurementProtocol.findMany({
        where,
        orderBy: [{ protocolDate: "desc" }, { number: "desc" }],
        skip,
        take: pageSize,
        include: {
          winnerCounterparty: { select: { id: true, nameCipher: true } },
          _count: { select: { bids: true } },
        },
      }),
      this.prisma.procurementProtocol.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.procurementProtocol.findFirst({
      where: { id, organizationId },
      include: this.includeDetail,
    });
    if (!row) throw new NotFoundException("Procurement protocol not found");
    return row;
  }

  private async assertCounterparty(organizationId: string, id: string) {
    const cp = await this.prisma.counterparty.findFirst({
      where: { id, organizationId },
    });
    if (!cp) throw new NotFoundException("Counterparty not found");
  }

  private async assertContract(organizationId: string, id: string) {
    const c = await this.prisma.contract.findFirst({
      where: { id, organizationId },
    });
    if (!c) throw new NotFoundException("Contract not found");
  }

  private mapBids(bids: CreateBidDto[] | undefined) {
    if (!bids?.length) return undefined;
    return bids.map((b) => ({
      counterpartyId: b.counterpartyId,
      amount: new Decimal(b.amount),
      isWinner: b.isWinner ?? false,
      note: b.note?.trim() ?? null,
    }));
  }

  async create(organizationId: string, dto: CreateProcurementProtocolDto) {
    if (dto.winnerCounterpartyId) {
      await this.assertCounterparty(organizationId, dto.winnerCounterpartyId);
    }
    if (dto.contractId) {
      await this.assertContract(organizationId, dto.contractId);
    }
    for (const bid of dto.bids ?? []) {
      await this.assertCounterparty(organizationId, bid.counterpartyId);
    }

    const bids = this.mapBids(dto.bids);
    return this.prisma.procurementProtocol.create({
      data: {
        organizationId,
        number: dto.number.trim(),
        protocolDate: parseIsoDateOnly(dto.protocolDate),
        procedureType: dto.procedureType,
        title: dto.title.trim(),
        winnerCounterpartyId: dto.winnerCounterpartyId ?? null,
        contractId: dto.contractId ?? null,
        notes: dto.notes?.trim() ?? null,
        bids: bids?.length ? { create: bids } : undefined,
      },
      include: this.includeDetail,
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateProcurementProtocolDto,
  ) {
    const existing = await this.get(organizationId, id);
    if (
      existing.status === ProcurementProtocolStatus.REGISTERED &&
      dto.bids != null &&
      dto.status === undefined
    ) {
      throw new BadRequestException("REGISTERED protocols cannot replace bids");
    }

    if (dto.winnerCounterpartyId) {
      await this.assertCounterparty(organizationId, dto.winnerCounterpartyId);
    }
    if (dto.contractId) {
      await this.assertContract(organizationId, dto.contractId);
    }
    for (const bid of dto.bids ?? []) {
      await this.assertCounterparty(organizationId, bid.counterpartyId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.bids != null) {
        await tx.bid.deleteMany({ where: { protocolId: id } });
        const mapped = this.mapBids(dto.bids);
        if (mapped?.length) {
          await tx.bid.createMany({
            data: mapped.map((b) => ({ ...b, protocolId: id })),
          });
        }
      }

      return tx.procurementProtocol.update({
        where: { id },
        data: {
          ...(dto.protocolDate != null
            ? { protocolDate: parseIsoDateOnly(dto.protocolDate) }
            : {}),
          ...(dto.procedureType != null
            ? { procedureType: dto.procedureType }
            : {}),
          ...(dto.title != null ? { title: dto.title.trim() } : {}),
          ...(dto.winnerCounterpartyId !== undefined
            ? { winnerCounterpartyId: dto.winnerCounterpartyId }
            : {}),
          ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
          ...(dto.status != null
            ? { status: dto.status as ProcurementProtocolStatus }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() ?? null }
            : {}),
        },
        include: this.includeDetail,
      });
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== ProcurementProtocolStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT protocols can be deleted");
    }
    await this.prisma.procurementProtocol.delete({ where: { id } });
    return { ok: true };
  }

  async register(organizationId: string, id: string) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== ProcurementProtocolStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT protocols can be registered");
    }
    return this.prisma.procurementProtocol.update({
      where: { id },
      data: { status: ProcurementProtocolStatus.REGISTERED },
      include: this.includeDetail,
    });
  }
}
