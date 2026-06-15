import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { BranchService } from "./branch.service";

class CreateBranchDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isHeadOffice?: boolean;
}

class CrossBranchWithdrawalDto {
  @IsString()
  customerAccountId!: string;

  @IsString()
  serviceBranchId!: string;

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
@ApiTags("branches")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("branches")
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  list() {
    return this.branchService.list();
  }

  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.branchService.create(dto);
  }

  @Post("cross-branch-withdrawal")
  crossBranchWithdrawal(@Body() dto: CrossBranchWithdrawalDto, @Req() req: BankAuthRequest) {
    return this.branchService.postCrossBranchWithdrawal({
      customerAccountId: dto.customerAccountId,
      serviceBranchId: dto.serviceBranchId,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      makerUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
      reference: dto.reference ?? `XBR-WD-${dto.idempotencyKey}`,
    });
  }
}
