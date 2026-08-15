import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { LoansService } from "./loans.service";

class OriginateLoanDto {
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
  @IsNumber()
  termMonths?: number;

  @IsOptional()
  @IsNumber()
  rateAnnual?: number;

  @IsOptional()
  @IsString()
  collateralDescription?: string;

  @IsOptional()
  @IsString()
  collateralAmountMinor?: string;

  @IsOptional()
  @IsString()
  collateralType?: string;

  @IsOptional()
  @IsBoolean()
  pricingException?: boolean;

  @IsOptional()
  @IsString()
  exceptionReason?: string;
}

class DisburseDto {
  @IsString()
  accountId!: string;
}

class RepayDto {
  @IsString()
  amountMinor!: string;
}

class RestructureDto {
  @IsNumber()
  ifrs9Stage!: number;
}

class CollateralDto {
  @IsString()
  description!: string;

  @IsString()
  amountMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

class BureauPullDto {
  @IsString()
  customerId!: string;
}

@ApiTags("loans")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("loans")
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  list(@Query("pendingPricing") pendingPricing?: string) {
    if (pendingPricing === "1" || pendingPricing === "true") {
      return this.loans.listPendingPricing();
    }
    return this.loans.list();
  }

  @Post()
  originate(@Body() dto: OriginateLoanDto, @Req() req: BankAuthRequest) {
    return this.loans.originate({
      customerId: dto.customerId,
      productTemplateId: dto.productTemplateId,
      principalMinor: BigInt(dto.principalMinor),
      currency: dto.currency,
      termMonths: dto.termMonths,
      rateAnnual: dto.rateAnnual,
      makerUserId: req.userId ?? "service",
      pricingException: dto.pricingException,
      exceptionReason: dto.exceptionReason,
      collateral: dto.collateralDescription
        ? {
            description: dto.collateralDescription,
            amountMinor: dto.collateralAmountMinor ?? "0",
            currency: dto.currency || "AZN",
            type: dto.collateralType,
          }
        : undefined,
    });
  }

  @Post(":id/pricing-approve")
  pricingApprove(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.loans.pricingApprove(id, req.userId ?? "service");
  }

  @Post(":id/pricing-reject")
  pricingReject(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.loans.pricingReject(id, req.userId ?? "service");
  }

  @Post(":id/rate-reset")
  rateReset(@Param("id") id: string) {
    return this.loans.resetFloatingRate(id);
  }

  @Post("bureau/pull")
  bureauPull(@Body() dto: BureauPullDto) {
    return this.loans.pullBureau(dto.customerId);
  }

  @Get(":id/schedule")
  schedule(@Param("id") id: string) {
    return this.loans.schedule(id);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.loans.getById(id);
  }

  @Post(":id/collateral")
  setCollateral(@Param("id") id: string, @Body() dto: CollateralDto) {
    return this.loans.setCollateral(id, {
      description: dto.description,
      amountMinor: dto.amountMinor,
      currency: dto.currency ?? "AZN",
      type: dto.type,
    });
  }

  @Post(":id/disburse")
  disburse(@Param("id") id: string, @Body() dto: DisburseDto) {
    return this.loans.disburse(id, dto.accountId);
  }

  @Post(":id/repay")
  repay(@Param("id") id: string, @Body() dto: RepayDto) {
    return this.loans.repay(id, BigInt(dto.amountMinor));
  }

  @Post(":id/restructure")
  restructure(
    @Param("id") id: string,
    @Body() dto: RestructureDto,
    @Req() req: BankAuthRequest,
  ) {
    return this.loans.restructure(id, dto.ifrs9Stage, req.userId ?? "service");
  }
}
