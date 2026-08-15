import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CollectionCaseStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { BankErrorCode } from "../../common/bank-error-codes";
import { assertIdempotencyKey } from "../../common/idempotency";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  listCases(status?: CollectionCaseStatus) {
    return this.prisma.collectionCase.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      include: { promises: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createCase(input: {
    loanId: string;
    customerId: string;
    outstandingMinor: string;
  }) {
    return this.prisma.collectionCase.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        loanId: input.loanId,
        customerId: input.customerId,
        outstandingMinor: BigInt(input.outstandingMinor),
      },
    });
  }

  async assign(id: string, assigneeUserId: string) {
    const c = await this.prisma.collectionCase.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!c) throw new NotFoundException("Case not found");
    return this.prisma.collectionCase.update({
      where: { id },
      data: { assigneeUserId, status: CollectionCaseStatus.ASSIGNED },
    });
  }

  async addPtp(id: string, amountMinor: string, dueDate: string) {
    const c = await this.prisma.collectionCase.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!c) throw new NotFoundException("Case not found");
    await this.prisma.collectionPromiseToPay.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        caseId: id,
        amountMinor: BigInt(amountMinor),
        dueDate: new Date(dueDate),
      },
    });
    return this.prisma.collectionCase.update({
      where: { id },
      data: { status: CollectionCaseStatus.PTP },
      include: { promises: true },
    });
  }

  async recover(input: {
    id: string;
    amountMinor: string;
    branchId: string;
    makerUserId: string;
    checkerUserId: string;
    idempotencyKey: string;
  }) {
    if (input.makerUserId === input.checkerUserId) {
      throw new ForbiddenException({
        code: BankErrorCode.SOD_SELF_APPROVE,
        message: "Maker cannot be checker",
      });
    }
    const key = assertIdempotencyKey(input.idempotencyKey);
    const c = await this.prisma.collectionCase.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!c) throw new NotFoundException("Case not found");
    const amount = BigInt(input.amountMinor);
    const workout = await this.systemGl.resolve(SystemGlKey.NPL_WORKOUT);
    const recovery = await this.systemGl.resolve(SystemGlKey.RECOVERY_INCOME);
    const txn = await this.postingEngine.post({
      reference: `COLL-REC:${c.id}`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.FEE,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: workout.id,
          branchId: input.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: c.currency,
        },
        {
          glAccountId: recovery.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: c.currency,
        },
      ],
    });
    return {
      case: await this.prisma.collectionCase.update({
        where: { id: c.id },
        data: {
          outstandingMinor:
            c.outstandingMinor > amount ? c.outstandingMinor - amount : 0n,
          status:
            c.outstandingMinor <= amount
              ? CollectionCaseStatus.CLOSED
              : c.status,
        },
      }),
      journalTxnId: txn.id,
      checkerUserId: input.checkerUserId,
    };
  }

  async writeOff(input: {
    id: string;
    makerUserId: string;
    checkerUserId: string;
  }) {
    if (input.makerUserId === input.checkerUserId) {
      throw new ForbiddenException({
        code: BankErrorCode.SOD_SELF_APPROVE,
        message: "Maker cannot be checker",
      });
    }
    const c = await this.prisma.collectionCase.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!c) throw new NotFoundException("Case not found");
    return this.prisma.collectionCase.update({
      where: { id: c.id },
      data: { status: CollectionCaseStatus.WRITTEN_OFF },
    });
  }

  async agingCount() {
    return this.prisma.collectionCase.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: ["OPEN", "ASSIGNED", "PTP", "LEGAL"] },
      },
    });
  }

  /** EOD step snapshot for open collection workload. */
  async agingSnapshot() {
    const openCount = await this.agingCount();
    return { openCount, asOf: new Date().toISOString() };
  }
}
