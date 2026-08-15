import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { DepositsService } from "./deposits.service";

class OpenDepositDto {
  @IsString()
  accountId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  productTemplateId!: string;

  @IsString()
  principalMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @IsOptional()
  @IsNumber()
  termMonths?: number;

  @IsOptional()
  @IsNumber()
  rateAnnual?: number;

  @IsOptional()
  @IsBoolean()
  pricingException?: boolean;

  @IsOptional()
  @IsString()
  exceptionReason?: string;
}

class RolloverDto {
  @IsDateString()
  newMaturityDate!: string;
}

@ApiTags("deposits")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("deposits")
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  @Get()
  list(@Query("pendingPricing") pendingPricing?: string) {
    if (pendingPricing === "1" || pendingPricing === "true") {
      return this.deposits.listPendingPricing();
    }
    return this.deposits.list();
  }

  @Post()
  open(@Body() dto: OpenDepositDto, @Req() req: BankAuthRequest) {
    return this.deposits.open({
      ...dto,
      principalMinor: BigInt(dto.principalMinor),
      maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : undefined,
      makerUserId: req.userId ?? "service",
      pricingException: dto.pricingException,
      exceptionReason: dto.exceptionReason,
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.deposits.getById(id);
  }

  @Post(":id/pricing-approve")
  pricingApprove(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.deposits.pricingApprove(id, req.userId ?? "service");
  }

  @Post(":id/pricing-reject")
  pricingReject(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.deposits.pricingReject(id, req.userId ?? "service");
  }

  @Post(":id/close")
  close(@Param("id") id: string) {
    return this.deposits.close(id);
  }

  @Post(":id/rollover")
  rollover(@Param("id") id: string, @Body() dto: RolloverDto) {
    return this.deposits.rollover(id, new Date(dto.newMaturityDate));
  }
}
