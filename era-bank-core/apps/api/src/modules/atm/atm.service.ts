import { Injectable, NotFoundException } from "@nestjs/common";
import { AtmTxnStatus, Prisma } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { SchemeSwitchAdapter } from "./scheme.adapter";

@Injectable()
export class AtmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly scheme: SchemeSwitchAdapter,
  ) {}

  listTerminals() {
    return this.prisma.atmTerminal.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { terminalId: "asc" },
    });
  }

  createTerminal(input: {
    terminalId: string;
    branchId: string;
    locationName: string;
  }) {
    return this.prisma.atmTerminal.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        terminalId: input.terminalId,
        branchId: input.branchId,
        locationName: input.locationName,
      },
    });
  }

  listTxns() {
    return this.prisma.atmTxn.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { terminal: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async authorizeTxn(input: {
    atmTerminalId: string;
    amountMinor: string;
    txnType: string;
    cardId?: string;
  }) {
    const terminal = await this.prisma.atmTerminal.findFirst({
      where: { id: input.atmTerminalId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!terminal) throw new NotFoundException("ATM terminal not found");

    const schemeResult = this.scheme.enqueue("ATM_AUTH", {
      terminalId: terminal.terminalId,
      amountMinor: input.amountMinor,
      txnType: input.txnType,
    });

    const outbox = await this.prisma.schemeMessageOutbox.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        messageType: "ATM_AUTH",
        direction: "OUT",
        payloadJson: schemeResult.payload as Prisma.InputJsonValue,
        status: schemeResult.accepted ? "SENT" : "FAILED",
        sentAt: schemeResult.accepted ? new Date() : undefined,
      },
    });

    return this.prisma.atmTxn.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        atmTerminalId: terminal.id,
        cardId: input.cardId,
        amountMinor: BigInt(input.amountMinor),
        txnType: input.txnType,
        status: AtmTxnStatus.AUTHORIZED,
        authCode: schemeResult.processorRef.slice(0, 12),
      },
      include: { terminal: true },
    }).then((txn) => ({ txn, schemeOutboxId: outbox.id }));
  }

  listSchemeOutbox() {
    return this.prisma.schemeMessageOutbox.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
