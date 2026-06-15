import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";
import { DboAccountsService } from "./dbo-accounts.service";

class InternalTransferDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toAccountId!: string;

  @IsString()
  amountMinor!: string;
}

@ApiTags("dbo-accounts")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo")
export class DboAccountsController {
  constructor(private readonly accounts: DboAccountsService) {}

  @Get("accounts")
  listAccounts(@Req() req: BankCustomerRequest) {
    return this.accounts.listAccounts(req.customerAuth);
  }

  @Get("accounts/:id")
  getAccount(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.accounts.getAccount(req.customerAuth, id);
  }

  @Get("accounts/:id/statement")
  statement(
    @Req() req: BankCustomerRequest,
    @Param("id") id: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.accounts.getStatement(
      req.customerAuth,
      id,
      new Date(from ?? Date.now() - 30 * 86400000),
      new Date(to ?? Date.now()),
    );
  }

  @Post("transfers/internal")
  internalTransfer(
    @Req() req: BankCustomerRequest,
    @Body() dto: InternalTransferDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.accounts.internalTransfer(req.customerAuth, {
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amountMinor: BigInt(dto.amountMinor),
      idempotencyKey: idempotencyKey ?? `transfer-${Date.now()}`,
    });
  }

  @Get("deposits")
  deposits(@Req() req: BankCustomerRequest) {
    return this.accounts.listDeposits(req.customerAuth);
  }

  @Get("loans")
  loans(@Req() req: BankCustomerRequest) {
    return this.accounts.listLoans(req.customerAuth);
  }
}
