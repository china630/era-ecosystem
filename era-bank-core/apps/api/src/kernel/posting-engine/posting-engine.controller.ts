import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TxnStatus, TxnType } from "@era/bank-core-database";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { PostingEngineService } from "./posting-engine.service";
import { TellerPostingService } from "./teller-posting.service";

class PostingLegDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  glAccountId!: string;

  @IsString()
  branchId!: string;

  @IsString()
  debitMinor!: string;

  @IsString()
  creditMinor!: string;

  @IsString()
  currency!: string;
}

class CreatePostingDto {
  @IsString()
  reference!: string;

  @IsString()
  idempotencyKey!: string;

  @IsDateString()
  valueDate!: string;

  @IsEnum(TxnType)
  type!: TxnType;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostingLegDto)
  legs!: PostingLegDto[];

  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}

class ApprovePostingDto {
  @IsOptional()
  @IsString()
  checkerUserId?: string;
}

class ReversePostingDto {
  @IsOptional()
  @IsString()
  makerUserId?: string;

  @IsString()
  reason!: string;

  @IsString()
  idempotencyKey!: string;
}

class RejectPostingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class TellerAmountDto {
  @IsString()
  accountId!: string;

  @IsString()
  amountMinor!: string;

  @IsString()
  currency!: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

class InternalTransferDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toAccountId!: string;

  @IsString()
  amountMinor!: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

@ApiTags("postings")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("postings")
export class PostingEngineController {
  constructor(
    private readonly postingEngine: PostingEngineService,
    private readonly tellerPosting: TellerPostingService,
  ) {}

  @Get()
  list(
    @Query("status") status?: TxnStatus,
    @Query("branchId") branchId?: string,
    @Query("type") type?: TxnType,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("limit") limit?: string,
  ) {
    return this.postingEngine.list({
      status,
      branchId,
      type,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("cash-deposit")
  cashDeposit(@Body() dto: TellerAmountDto, @Req() req: BankAuthRequest) {
    return this.tellerPosting.cashDeposit({
      accountId: dto.accountId,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      makerUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
      reference: dto.reference,
    });
  }

  @Post("cash-withdrawal")
  cashWithdrawal(@Body() dto: TellerAmountDto, @Req() req: BankAuthRequest) {
    return this.tellerPosting.cashWithdrawal({
      accountId: dto.accountId,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      makerUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
      reference: dto.reference,
    });
  }

  @Post("internal-transfer")
  internalTransfer(@Body() dto: InternalTransferDto, @Req() req: BankAuthRequest) {
    return this.tellerPosting.internalTransfer({
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amountMinor: BigInt(dto.amountMinor),
      makerUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
      reference: dto.reference,
    });
  }

  @Post()
  create(@Body() dto: CreatePostingDto, @Req() req: BankAuthRequest) {
    const makerUserId = req.userId ?? "service";
    return this.postingEngine.post({
      reference: dto.reference,
      idempotencyKey: dto.idempotencyKey,
      valueDate: new Date(dto.valueDate),
      type: dto.type,
      makerUserId,
      branchId: dto.branchId,
      autoApprove: dto.autoApprove,
      legs: dto.legs.map((l) => ({
        accountId: l.accountId,
        glAccountId: l.glAccountId,
        branchId: l.branchId,
        debitMinor: BigInt(l.debitMinor),
        creditMinor: BigInt(l.creditMinor),
        currency: l.currency,
      })),
    });
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.postingEngine.findById(id);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @Body() dto: ApprovePostingDto, @Req() req: BankAuthRequest) {
    const checkerUserId = dto.checkerUserId ?? req.userId ?? "service";
    return this.postingEngine.approve({ transactionId: id, checkerUserId });
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: RejectPostingDto, @Req() req: BankAuthRequest) {
    return this.postingEngine.reject(id, req.userId ?? "service", dto.reason);
  }

  @Post(":id/reverse")
  reverse(@Param("id") id: string, @Body() dto: ReversePostingDto, @Req() req: BankAuthRequest) {
    return this.postingEngine.reverse({
      transactionId: id,
      makerUserId: dto.makerUserId ?? req.userId ?? "service",
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
