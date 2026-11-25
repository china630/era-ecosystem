import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { LoansService } from "../loans/loans.service";
import { LeasingService } from "../leasing/leasing.service";
import {
  BankCustomerAuthGuard,
  type BankCustomerRequest,
} from "./bank-customer-auth.guard";
import { DboAccountsService } from "./dbo-accounts.service";

class InternalTransferDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toAccountId!: string;

  @IsString()
  amountMinor!: string;
}

class DboPrepayDto {
  @IsString()
  amountMinor!: string;

  @IsIn(["REDUCE_TERM", "REDUCE_INSTALLMENT"])
  mode!: "REDUCE_TERM" | "REDUCE_INSTALLMENT";

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

@ApiTags("dbo-accounts")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo")
export class DboAccountsController {
  constructor(
    private readonly accounts: DboAccountsService,
    private readonly loans: LoansService,
    private readonly leasing: LeasingService,
  ) {}

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
      idempotencyKey:
        idempotencyKey ??
        `transfer-${dto.fromAccountId}-${dto.toAccountId}-${dto.amountMinor}`,
    });
  }

  @Get("deposits")
  deposits(@Req() req: BankCustomerRequest) {
    return this.accounts.listDeposits(req.customerAuth);
  }

  @Get("loans")
  loansList(@Req() req: BankCustomerRequest) {
    return this.accounts.listLoans(req.customerAuth);
  }

  @Get("loans/:id")
  async loanGet(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    const loan = await this.accounts.getLoan(req.customerAuth, id);
    if (!loan) throw new NotFoundException("Loan not found");
    return loan;
  }

  @Post("loans/:id/prepay")
  async loanPrepay(
    @Req() req: BankCustomerRequest,
    @Param("id") id: string,
    @Body() dto: DboPrepayDto,
  ) {
    const loan = await this.accounts.getLoan(req.customerAuth, id);
    if (!loan) throw new NotFoundException("Loan not found");
    return this.loans.prepay(
      id,
      {
        amountMinor: BigInt(dto.amountMinor),
        mode: dto.mode,
        idempotencyKey:
          dto.idempotencyKey ??
          `dbo-prepay-${id}-${dto.amountMinor}-${dto.mode}`,
      },
      req.customerAuth.sub,
    );
  }

  @Get("leasing/contracts")
  leasingContracts(@Req() req: BankCustomerRequest) {
    return this.accounts.listLeases(req.customerAuth);
  }

  @Get("leasing/contracts/:id/schedule")
  async leasingSchedule(
    @Req() req: BankCustomerRequest,
    @Param("id") id: string,
  ) {
    const lease = await this.accounts.getLease(req.customerAuth, id);
    if (!lease) throw new NotFoundException("Lease not found");
    return this.leasing.getSchedule(id);
  }
}
