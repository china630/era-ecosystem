import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContractStatus,
  Decimal,
  PayApplicationStatus,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { CreatePayApplicationDto } from "./dto/pay-application.dto";
import {
  buildPayApplicationPrintSnapshot,
  renderKs2Html,
  renderKs3Html,
} from "./pay-application-print-snapshot.build";

@Injectable()
export class PayApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  private include = {
    contract: { select: { id: true, number: true, status: true, amountLimit: true } },
    lines: { orderBy: { sortOrder: "asc" as const } },
  };

  async list(organizationId: string, opts?: { page?: number; pageSize?: number }) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.payApplication.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          contract: { select: { id: true, number: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.payApplication.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.payApplication.findFirst({
      where: { id, organizationId },
      include: this.include,
    });
    if (!row) throw new NotFoundException("Pay application not found");
    return row;
  }

  private totals(lines: { amount: Decimal | number }[], retentionPct: number) {
    const gross = lines.reduce(
      (s, l) => s.add(new Decimal(l.amount.toString())),
      new Decimal(0),
    );
    const retention = gross.mul(retentionPct).div(100);
    const net = gross.sub(retention);
    return { gross, retention, net };
  }

  async create(organizationId: string, dto: CreatePayApplicationDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: dto.contractId, organizationId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!contract) throw new NotFoundException("Contract not found");
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("PayApp requires ACTIVE contract");
    }

    let lineInputs = dto.lines ?? [];
    if (dto.fromSov && !lineInputs.length) {
      lineInputs = contract.lines.map((l, idx) => ({
        contractLineId: l.id,
        description: l.description ?? l.code ?? `Line ${idx + 1}`,
        quantity: l.quantity != null ? Number(l.quantity) : undefined,
        amount: l.amount != null ? Number(l.amount) : 0,
        sortOrder: l.sortOrder,
      }));
    }

    const retentionPct = dto.retentionPct ?? 0;
    const { gross, retention, net } = this.totals(
      lineInputs.map((l) => ({ amount: l.amount })),
      retentionPct,
    );

    if (contract.amountLimit != null && gross.gt(contract.amountLimit)) {
      throw new BadRequestException({
        code: "PAYAPP_OVER_SOV",
        message: "Gross exceeds contract amountLimit",
        limit: new Decimal(contract.amountLimit).toFixed(4),
        gross: gross.toFixed(4),
      });
    }

    return this.prisma.payApplication.create({
      data: {
        organizationId,
        contractId: dto.contractId,
        number: dto.number.trim(),
        periodFrom: dto.periodFrom ? parseIsoDateOnly(dto.periodFrom) : null,
        periodTo: dto.periodTo ? parseIsoDateOnly(dto.periodTo) : null,
        retentionPct: new Decimal(retentionPct),
        amountGross: gross,
        amountRetention: retention,
        amountNet: net,
        status: PayApplicationStatus.DRAFT,
        lines: lineInputs.length
          ? {
              create: lineInputs.map((l, idx) => ({
                contractLineId: l.contractLineId ?? null,
                description: l.description?.trim() ?? null,
                quantity:
                  l.quantity != null ? new Decimal(l.quantity) : null,
                amount: new Decimal(l.amount),
                sourceActId: l.sourceActId?.trim() ?? null,
                sortOrder: l.sortOrder ?? idx,
              })),
            }
          : undefined,
      },
      include: this.include,
    });
  }

  async submit(organizationId: string, id: string) {
    const row = await this.get(organizationId, id);
    if (row.status !== PayApplicationStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT can be submitted");
    }
    return this.prisma.payApplication.update({
      where: { id },
      data: { status: PayApplicationStatus.SUBMITTED },
      include: this.include,
    });
  }

  async approve(organizationId: string, id: string) {
    const row = await this.get(organizationId, id);
    if (
      row.status !== PayApplicationStatus.SUBMITTED &&
      row.status !== PayApplicationStatus.DRAFT
    ) {
      throw new BadRequestException("Only DRAFT/SUBMITTED can be approved");
    }
    const snapshot = await buildPayApplicationPrintSnapshot(this.prisma, {
      organizationId,
      payApplicationId: id,
    });
    return this.prisma.payApplication.update({
      where: { id },
      data: {
        status: PayApplicationStatus.APPROVED,
        printSnapshotJson: snapshot as object,
      },
      include: this.include,
    });
  }

  async post(organizationId: string, id: string) {
    const row = await this.get(organizationId, id);
    if (row.status !== PayApplicationStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED can be posted");
    }
    const reference = `payapp:${id}`;
    const existing = await this.prisma.transaction.findFirst({
      where: { organizationId, reference },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.payApplication.update({
        where: { id },
        data: {
          status: PayApplicationStatus.POSTED,
          postedJournalId: existing.id,
        },
        include: this.include,
      });
    }

    const net = Number(row.amountNet);
    if (!(net > 0)) {
      throw new BadRequestException("PayApp net amount must be positive");
    }

    return this.prisma.$transaction(async (tx) => {
      const [receivable, wip] = await Promise.all([
        this.posting.resolveAccountCode(organizationId, "TRADE_RECEIVABLE", tx),
        this.posting.resolveAccountCode(organizationId, "WIP_MANUFACTURING", tx),
      ]);
      const { transactionId } = await this.accounting.postJournalInTransaction(
        tx,
        {
          organizationId,
          date: new Date(),
          reference,
          description: `Pay application ${row.number} (retention ${row.amountRetention})`,
          lines: [
            { accountCode: receivable, debit: net, credit: 0 },
            { accountCode: wip, debit: 0, credit: net },
          ],
        },
      );

      return tx.payApplication.update({
        where: { id },
        data: {
          status: PayApplicationStatus.POSTED,
          postedJournalId: transactionId,
        },
        include: this.include,
      });
    });
  }

  async getPrintSnapshot(organizationId: string, id: string) {
    const row = await this.get(organizationId, id);
    if (row.printSnapshotJson && row.status !== PayApplicationStatus.DRAFT) {
      return row.printSnapshotJson;
    }
    return buildPayApplicationPrintSnapshot(this.prisma, {
      organizationId,
      payApplicationId: id,
    });
  }

  async getPrintHtml(
    organizationId: string,
    id: string,
    kind: "ks2" | "ks3",
  ) {
    const snapshot = await this.getPrintSnapshot(organizationId, id);
    return kind === "ks3"
      ? renderKs3Html(snapshot as Record<string, unknown>)
      : renderKs2Html(snapshot as Record<string, unknown>);
  }
}
