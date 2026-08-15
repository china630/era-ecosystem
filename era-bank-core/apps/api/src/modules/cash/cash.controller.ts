import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
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
      makerUserId: req.userId ?? "service",
    });
  }

  @Post("movements/:id/post")
  postMovement(@Req() req: BankAuthRequest, @Param("id") id: string) {
    return this.cash.postMovement(id, req.userId ?? "service");
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
      makerUserId: req.userId ?? "service",
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

  @Post("queue/:id/assign")
  assignTicket(
    @Param("id") id: string,
    @Body() body: { assigneeUserId: string },
  ) {
    return this.cash.assignQueueTicket(id, body.assigneeUserId);
  }

  @Post("queue/:id/notes")
  queueNote(
    @Req() req: BankAuthRequest,
    @Param("id") id: string,
    @Body() body: { note: string },
  ) {
    return this.cash.addQueueNote(id, body.note, req.userId ?? "service");
  }

  @Post("queue/:id/complete")
  completeTicket(@Param("id") id: string) {
    return this.cash.completeQueueTicket(id);
  }

  @Post("inventory/:id/move-post")
  moveInventoryWithGl(
    @Req() req: BankAuthRequest,
    @Param("id") id: string,
    @Body() body: MoveInvDto & { postGl?: boolean; branchId?: string },
  ) {
    return this.cash.postInventoryMovement({
      itemId: id,
      deltaQty: body.deltaQty,
      reason: body.reason,
      makerUserId: req.userId ?? "service",
      postGl: body.postGl,
      branchId: body.branchId,
    });
  }
}
