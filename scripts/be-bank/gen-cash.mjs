import fs from "fs";
import path from "path";

const root = "d:/My Projects/era-ecosystem/era-bank-core/apps/api/src";
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w(
  "modules/cash/cash.module.ts",
  `import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { CashController } from "./cash.controller";
import { CashService } from "./cash.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
`,
);

w(
  "modules/cash/cash.service.ts",
  `import {
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
      reference: \`CASH:\${mv.id}\`,
      idempotencyKey: \`cash-post-\${mv.idempotencyKey}\`,
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
    await this.prisma.inventoryMovement.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        itemId: item.id,
        deltaQty: input.deltaQty,
        reason: input.reason,
        makerUserId: input.makerUserId,
      },
    });
    return this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: next },
    });
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
}
`,
);

w(
  "modules/cash/cash.controller.ts",
  `import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { CashMovementKind, InventoryItemKind } from "@era/bank-core-database";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { CashService } from "./cash.service";

class CreateMovementDto {
  @IsString() branchId!: string;
  @IsEnum(CashMovementKind) kind!: CashMovementKind;
  @IsString() amountMinor!: string;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsString() reference?: string;
}
class InventoryDto {
  @IsString() branchId!: string;
  @IsEnum(InventoryItemKind) kind!: InventoryItemKind;
  @IsString() sku!: string;
  @IsString() name!: string;
  @IsOptional() @IsInt() quantity?: number;
}
class MoveInvDto {
  @IsInt() deltaQty!: number;
  @IsString() reason!: string;
}
class QueueDto {
  @IsString() branchId!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() serviceKey?: string;
}

@ApiTags("cash")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("cash")
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get("movements")
  listMovements(@Query("branchId") branchId?: string) {
    return this.cash.listMovements(branchId);
  }

  @Post("movements")
  createMovement(@Req() req: BankAuthRequest, @Body() body: CreateMovementDto) {
    return this.cash.createMovement({
      ...body,
      makerUserId: req.user?.sub ?? "service",
    });
  }

  @Post("movements/:id/post")
  postMovement(@Req() req: BankAuthRequest, @Param("id") id: string) {
    return this.cash.postMovement(id, req.user?.sub ?? "service");
  }

  @Get("inventory")
  listInventory(@Query("branchId") branchId?: string) {
    return this.cash.listInventory(branchId);
  }

  @Post("inventory")
  upsertInventory(@Body() body: InventoryDto) {
    return this.cash.upsertInventory(body);
  }

  @Post("inventory/:id/move")
  moveInventory(
    @Req() req: BankAuthRequest,
    @Param("id") id: string,
    @Body() body: MoveInvDto,
  ) {
    return this.cash.moveInventory({
      itemId: id,
      ...body,
      makerUserId: req.user?.sub ?? "service",
    });
  }

  @Get("queue")
  listQueue(@Query("branchId") branchId: string) {
    return this.cash.listQueue(branchId);
  }

  @Post("queue")
  createTicket(@Body() body: QueueDto) {
    return this.cash.createQueueTicket(body);
  }
}
`,
);

console.log("cash ok");
