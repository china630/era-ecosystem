import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TradeInstrumentStatus, TxnType, ScfProgramStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { BankErrorCode } from "../../common/bank-error-codes";
import { assertIdempotencyKey } from "../../common/idempotency";
import { SWIFT_MT_TYPES } from "../../common/fc2-fc7.util";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";

@Injectable()
export class TradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  listLc() {
    return this.prisma.letterOfCredit.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { amendments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createLc(input: {
    customerId: string;
    reference: string;
    amountMinor: string;
    direction?: string;
    beneficiaryName?: string;
  }) {
    return this.prisma.letterOfCredit.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        reference: input.reference,
        amountMinor: BigInt(input.amountMinor),
        direction: input.direction ?? "IMPORT",
        beneficiaryName: input.beneficiaryName,
      },
    });
  }

  async issueLc(input: {
    id: string;
    branchId: string;
    makerUserId: string;
    idempotencyKey: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const lc = await this.prisma.letterOfCredit.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!lc) throw new NotFoundException("LC not found");
    if (lc.status !== TradeInstrumentStatus.DRAFT) {
      throw new BadRequestException({
        code: BankErrorCode.INVALID_STATE,
        message: "LC not in DRAFT",
      });
    }
    const asset = await this.systemGl.resolve(SystemGlKey.TRADE_CONTINGENT_ASSET);
    const liab = await this.systemGl.resolve(
      SystemGlKey.TRADE_CONTINGENT_LIABILITY,
    );
    const amount = lc.amountMinor;
    const txn = await this.postingEngine.post({
      reference: `LC-ISSUE:${lc.reference}`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.CONTINGENT,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: asset.id,
          branchId: input.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: lc.currency,
        },
        {
          glAccountId: liab.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: lc.currency,
        },
      ],
    });
    return this.prisma.letterOfCredit.update({
      where: { id: lc.id },
      data: {
        status: TradeInstrumentStatus.ISSUED,
        journalTxnId: txn.id,
      },
    });
  }

  async amendLc(id: string, note: string) {
    const lc = await this.prisma.letterOfCredit.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!lc) throw new NotFoundException("LC not found");
    const last = await this.prisma.tradeLcAmendment.findFirst({
      where: { lcId: id },
      orderBy: { seqNo: "desc" },
    });
    await this.prisma.tradeLcAmendment.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        lcId: id,
        seqNo: (last?.seqNo ?? 0) + 1,
        note,
      },
    });
    return this.prisma.letterOfCredit.update({
      where: { id },
      data: { status: TradeInstrumentStatus.AMENDED },
      include: { amendments: true },
    });
  }

  listGuarantees() {
    return this.prisma.bankGuarantee.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      take: 100,
    });
  }

  createGuarantee(input: {
    customerId: string;
    reference: string;
    amountMinor: string;
    kind?: string;
  }) {
    return this.prisma.bankGuarantee.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        reference: input.reference,
        amountMinor: BigInt(input.amountMinor),
        kind: input.kind ?? "BG",
      },
    });
  }

  async issueGuarantee(input: {
    id: string;
    branchId: string;
    makerUserId: string;
    idempotencyKey: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const bg = await this.prisma.bankGuarantee.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!bg) throw new NotFoundException("Guarantee not found");
    const asset = await this.systemGl.resolve(SystemGlKey.TRADE_CONTINGENT_ASSET);
    const liab = await this.systemGl.resolve(
      SystemGlKey.TRADE_CONTINGENT_LIABILITY,
    );
    const txn = await this.postingEngine.post({
      reference: `BG-ISSUE:${bg.reference}`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.CONTINGENT,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: asset.id,
          branchId: input.branchId,
          debitMinor: bg.amountMinor,
          creditMinor: 0n,
          currency: bg.currency,
        },
        {
          glAccountId: liab.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: bg.amountMinor,
          currency: bg.currency,
        },
      ],
    });
    return this.prisma.bankGuarantee.update({
      where: { id: bg.id },
      data: { status: TradeInstrumentStatus.ISSUED, journalTxnId: txn.id },
    });
  }

  listDc() {
    return this.prisma.documentaryCollection.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  createDc(input: {
    customerId: string;
    reference: string;
    amountMinor: string;
  }) {
    return this.prisma.documentaryCollection.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        reference: input.reference,
        amountMinor: BigInt(input.amountMinor),
      },
    });
  }

  listScf() {
    return this.prisma.scfProgram.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  createScf(input: { code: string; name: string; anchorBuyerId?: string }) {
    return this.prisma.scfProgram.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: input.code,
        name: input.name,
        anchorBuyerId: input.anchorBuyerId,
        status: ScfProgramStatus.DRAFT,
      },
    });
  }

  activateScf(id: string) {
    return this.prisma.scfProgram.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: ScfProgramStatus.ACTIVE },
    });
  }

  fundScf(id: string, amountMinor: bigint) {
    return this.prisma.scfProgram.updateMany({
      where: {
        id,
        bankOrgId: this.bankOrg.bankOrgId,
        status: ScfProgramStatus.ACTIVE,
      },
      data: {
        status: ScfProgramStatus.FUNDED,
        fundedMinor: amountMinor,
      },
    });
  }

  swiftMessageTypes() {
    return { supported: [...SWIFT_MT_TYPES], liveMode: "SENT_STUB" };
  }

  queueSwift(input: { mtType: string; body: string; relatedRef?: string }) {
    if (!SWIFT_MT_TYPES.includes(input.mtType as (typeof SWIFT_MT_TYPES)[number])) {
      throw new BadRequestException(`Unsupported SWIFT MT type: ${input.mtType}`);
    }
    return this.prisma.tradeSwiftMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        mtType: input.mtType,
        body: input.body,
        relatedRef: input.relatedRef,
      },
    });
  }

  async submitSwift(id: string) {
    const msg = await this.prisma.tradeSwiftMessage.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!msg) throw new NotFoundException("SWIFT message not found");
    return this.prisma.tradeSwiftMessage.update({
      where: { id },
      data: { status: "SENT_STUB" },
    });
  }

  async contingentOpenCount() {
    return this.prisma.letterOfCredit.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: ["ISSUED", "ADVISED", "AMENDED", "DOCUMENTS_PRESENTED"] },
      },
    });
  }

  /** Trade packing credit (LOAN_TRADE) — links LC reference to contingent exposure. */
  async registerPackingCredit(input: {
    customerId: string;
    tradeRef: string;
    lcId: string;
    amountMinor: bigint;
  }) {
    const lc = await this.prisma.letterOfCredit.findFirst({
      where: { id: input.lcId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!lc) throw new NotFoundException("LC not found");
    return {
      tradeRef: input.tradeRef,
      lcReference: lc.reference,
      amountMinor: input.amountMinor.toString(),
      customerId: input.customerId,
      status: "REGISTERED",
      note: "Use LOAN_TRADE product origination with matching tradeRef",
    };
  }

  async contingentRevalStub(_asOf: Date) {
    const openLc = await this.contingentOpenCount();
    const openBg = await this.prisma.bankGuarantee.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: ["ISSUED", "ADVISED", "AMENDED", "CLAIMED"] },
      },
    });
    return { openLc, openBg, revalued: false };
  }
}
