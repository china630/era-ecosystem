import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashMovementKind,
  CashMovementStatus,
  InventoryItemKind,
  TxnType,
} from "@era/bank-core-database";
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
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  listMovements(branchId?: string) {
    return this.prisma.cashMovement.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createMovement(input: {
    branchId: string;
    kind: CashMovementKind;
    amountMinor: string;
    idempotencyKey: string;
    makerUserId: string;
    reference?: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    return this.prisma.cashMovement.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        branchId: input.branchId,
        kind: input.kind,
        amountMinor: BigInt(input.amountMinor),
        idempotencyKey: key,
        makerUserId: input.makerUserId,
        reference: input.reference,
        status: CashMovementStatus.DRAFT,
      },
    });
  }

  async postMovement(id: string, makerUserId: string) {
    const mv = await this.prisma.cashMovement.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!mv) throw new NotFoundException("Cash movement not found");
    if (mv.status !== CashMovementStatus.DRAFT) {
      throw new BadRequestException({
        code: BankErrorCode.INVALID_STATE,
        message: "Already posted",
      });
    }
    const vault = await this.systemGl.resolve(SystemGlKey.CASH_VAULT);
    const till = await this.systemGl.resolve(SystemGlKey.TELLER_TILL);
    const amount = mv.amountMinor;
    const toVault =
      mv.kind === CashMovementKind.TILL_TO_VAULT ||
      mv.kind === CashMovementKind.CIT_IN;
    const debitGl = toVault ? vault.id : till.id;
    const creditGl = toVault ? till.id : vault.id;
    const txn = await this.postingEngine.post({
      reference: `CASH:${mv.id}`,
      idempotencyKey: `cash-post-${mv.idempotencyKey}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId,
      branchId: mv.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: debitGl,
          branchId: mv.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: mv.currency,
        },
        {
          glAccountId: creditGl,
          branchId: mv.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: mv.currency,
        },
      ],
    });
    return this.prisma.cashMovement.update({
      where: { id },
      data: { status: CashMovementStatus.POSTED, journalTxnId: txn.id },
    });
  }

  listInventory(branchId?: string) {
    return this.prisma.inventoryItem.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(branchId ? { branchId } : {}),
      },
    });
  }

  async upsertInventory(input: {
    branchId: string;
    kind: InventoryItemKind;
    sku: string;
    name: string;
    quantity?: number;
  }) {
    return this.prisma.inventoryItem.upsert({
      where: {
        bankOrgId_branchId_sku: {
          bankOrgId: this.bankOrg.bankOrgId,
          branchId: input.branchId,
          sku: input.sku,
        },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        branchId: input.branchId,
        kind: input.kind,
        sku: input.sku,
        name: input.name,
        quantity: input.quantity ?? 0,
      },
      update: { name: input.name, kind: input.kind },
    });
  }

  async moveInventory(input: {
    itemId: string;
    deltaQty: number;
    reason: string;
    makerUserId: string;
  }) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: input.itemId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    const next = item.quantity + input.deltaQty;
    if (next < 0) {
      throw new BadRequestException("Insufficient inventory");
    }
    const movement = await this.prisma.inventoryMovement.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        itemId: item.id,
        deltaQty: input.deltaQty,
        reason: input.reason,
        makerUserId: input.makerUserId,
      },
    });
    await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: next },
    });
    return movement;
  }

  async createQueueTicket(input: {
    branchId: string;
    customerId?: string;
    serviceKey?: string;
  }) {
    const last = await this.prisma.branchQueueTicket.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        branchId: input.branchId,
      },
      orderBy: { ticketNo: "desc" },
    });
    const ticketNo = (last?.ticketNo ?? 0) + 1;
    return this.prisma.branchQueueTicket.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        branchId: input.branchId,
        ticketNo,
        customerId: input.customerId,
        serviceKey: input.serviceKey ?? "GENERAL",
      },
    });
  }

  listQueue(branchId: string) {
    return this.prisma.branchQueueTicket.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        branchId,
        status: { in: ["WAITING", "SERVING"] },
      },
      orderBy: { ticketNo: "asc" },
    });
  }

  async countSdbRentDue(asOf: Date) {
    return this.prisma.safeDepositBox.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "RENTED",
        nextRentDate: { lte: asOf },
      },
    });
  }

  assignQueueTicket(id: string, assigneeUserId: string) {
    return this.prisma.branchQueueTicket.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { assigneeUserId, status: "SERVING" },
    });
  }

  addQueueNote(id: string, note: string, authorUserId?: string) {
    return this.prisma.branchQueueTicket.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    }).then(async (ticket) => {
      if (!ticket) throw new NotFoundException("Queue ticket not found");
      const notes = Array.isArray(ticket.crmNotes) ? [...(ticket.crmNotes as unknown[])] : [];
      notes.push({
        at: new Date().toISOString(),
        authorUserId: authorUserId ?? "service",
        text: note,
      });
      return this.prisma.branchQueueTicket.update({
        where: { id },
        data: { crmNotes: notes as never },
      });
    });
  }

  completeQueueTicket(id: string) {
    return this.prisma.branchQueueTicket.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: "DONE" },
    });
  }

  async postInventoryMovement(input: {
    itemId: string;
    deltaQty: number;
    reason: string;
    makerUserId: string;
    postGl?: boolean;
    branchId?: string;
  }) {
    const movement = await this.moveInventory({
      itemId: input.itemId,
      deltaQty: input.deltaQty,
      reason: input.reason,
      makerUserId: input.makerUserId,
    });
    if (!input.postGl || input.deltaQty <= 0) return movement;

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: input.itemId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");

    const branchId = input.branchId ?? item.branchId;
    const expenseGl = await this.systemGl.resolve(SystemGlKey.FEE_INCOME);
    const inventoryGl = await this.systemGl.resolve(SystemGlKey.CASH_VAULT);
    const amountMinor = BigInt(Math.abs(input.deltaQty) * 100);

    const txn = await this.postingEngine.post({
      reference: `INV-${item.sku}`,
      idempotencyKey: `inv-post-${movement.id}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId: input.makerUserId,
      branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: expenseGl.id,
          branchId,
          debitMinor: amountMinor,
          creditMinor: 0n,
          currency: "AZN",
        },
        {
          glAccountId: inventoryGl.id,
          branchId,
          debitMinor: 0n,
          creditMinor: amountMinor,
          currency: "AZN",
        },
      ],
    });

    await this.prisma.inventoryMovement.update({
      where: { id: movement.id },
      data: { journalTxnId: txn.id },
    });

    return { movement, journalTxnId: txn.id };
  }
}
