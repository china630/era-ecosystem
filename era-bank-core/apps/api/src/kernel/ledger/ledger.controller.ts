import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { AccountStatus } from "@era/bank-core-database";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { LedgerService } from "./ledger.service";

class OpenAccountDto {
  @IsString()
  customerId!: string;

  @IsString()
  branchId!: string;

  @IsString()
  glAccountId!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  currency!: string;

  @IsString()
  idempotencyKey!: string;
}

class PlaceHoldDto {
  @IsString()
  amountMinor!: string;

  @IsString()
  reason!: "MANUAL" | "CARD_AUTH" | "PAYMENT_PENDING";
}

@ApiTags("accounts")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller()
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("gl/accounts")
  listGl() {
    return this.ledger.listGlAccounts();
  }

  @Get("gl/trial-balance")
  trialBalance(@Query("date") date?: string) {
    return this.ledger.trialBalance(date ? new Date(date) : new Date());
  }

  @Post("accounts")
  openAccount(@Body() dto: OpenAccountDto, @Req() req: BankAuthRequest) {
    return this.ledger.openAccount({
      ...dto,
      makerUserId: req.userId ?? "service",
    });
  }

  @Get("accounts")
  listAccounts(
    @Query("customerId") customerId?: string,
    @Query("branchId") branchId?: string,
    @Query("iban") iban?: string,
    @Query("status") status?: AccountStatus,
  ) {
    return this.ledger.listAccounts({ customerId, branchId, iban, status });
  }

  @Get("accounts/:id")
  getAccount(@Param("id") id: string) {
    return this.ledger.getAccount(id);
  }

  @Get("accounts/:id/statement")
  statement(
    @Param("id") id: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.ledger.getStatement(id, new Date(from), new Date(to));
  }

  @Post("accounts/:id/close")
  closeAccount(@Param("id") id: string) {
    return this.ledger.closeAccount(id);
  }

  @Post("accounts/:id/holds")
  placeHold(@Param("id") id: string, @Body() dto: PlaceHoldDto) {
    return this.ledger.placeHold(id, BigInt(dto.amountMinor), dto.reason);
  }

  @Delete("accounts/:id/holds/:holdId")
  releaseHold(@Param("id") id: string, @Param("holdId") holdId: string) {
    return this.ledger.releaseHold(id, holdId);
  }
}
