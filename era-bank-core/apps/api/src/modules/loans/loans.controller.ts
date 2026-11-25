import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { LoansService } from "./loans.service";
import { CollateralService } from "./collateral.service";
import { CreditRegistryService } from "./credit-registry.service";

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

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class AttachCollateralDto {
  @IsString()
  collateralItemId!: string;

  @IsNumber()
  sharePct!: number;
}

class CreateCollateralItemDto {
  @IsString()
  ownerId!: string;

  @IsString()
  type!: string;

  @IsString()
  valuationMinor!: string;

  @IsOptional()
  @IsNumber()
  haircutPct?: number;

  @IsString()
  registry!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class PrepayDto {
  @IsString()
  amountMinor!: string;

  @IsString()
  mode!: "REDUCE_TERM" | "REDUCE_INSTALLMENT";

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
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

class QualityFlagsDto {
  @IsArray()
  @IsString({ each: true })
  qualityFlags!: string[];
}

@ApiTags("loans")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("loans")
export class LoansController {
  constructor(
    private readonly loans: LoansService,
    private readonly collateral: CollateralService,
    private readonly creditRegistry: CreditRegistryService,
  ) {}

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

  @Get("ckr/queue")
  ckrQueue(@Query("pendingOnly") pendingOnly?: string) {
    return this.creditRegistry.listQueue(
      pendingOnly === "1" || pendingOnly === "true",
    );
  }

  @Get("ckr/journal")
  ckrJournal(@Query("limit") limit?: string) {
    return this.creditRegistry.listSubmitJournal(
      limit ? Number(limit) : 50,
    );
  }

  @Post("ckr/validate-pack")
  ckrValidate(@Body() body: { batchId: string }) {
    return this.creditRegistry.validatePendingPack(body.batchId);
  }

  @Post("ckr/submit-stub")
  ckrSubmitStub(@Body() body: { batchId: string }) {
    return this.creditRegistry.submitPendingStubBatch(body.batchId);
  }

  /** Static path before `:id` so Nest does not treat `collateral-items` as an id. */
  @Get("collateral-items")
  listCollateralItems(@Query("maxAgeDays") maxAgeDays?: string) {
    const days = maxAgeDays ? Number(maxAgeDays) : 365;
    return this.collateral.listWithStaleFlags(
      Number.isFinite(days) && days > 0 ? days : 365,
    );
  }

  @Post("collateral-items")
  createCollateralItem(@Body() dto: CreateCollateralItemDto) {
    return this.collateral.createItem({
      ownerId: dto.ownerId,
      type: dto.type,
      valuationMinor: BigInt(dto.valuationMinor),
      haircutPct: dto.haircutPct,
      registry: dto.registry,
      description: dto.description,
    });
  }

  @Post("collateral-items/:itemId/revalue")
  revalueCollateralItem(
    @Param("itemId") itemId: string,
    @Body() body: { valuationMinor: string; haircutPct?: number },
  ) {
    return this.collateral.revalueItem(
      itemId,
      BigInt(body.valuationMinor),
      body.haircutPct,
    );
  }

  @Get(":id/schedule")
  schedule(@Param("id") id: string) {
    return this.loans.schedule(id);
  }

  @Get(":id/collateral-links")
  listCollateralLinks(@Param("id") id: string) {
    return this.collateral.listForLoan(id);
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

  @Post(":id/collateral-links")
  attachCollateral(@Param("id") id: string, @Body() dto: AttachCollateralDto) {
    return this.collateral.attachToLoan(id, {
      collateralItemId: dto.collateralItemId,
      sharePct: dto.sharePct,
    });
  }

  @Patch(":id/quality-flags")
  setQualityFlags(@Param("id") id: string, @Body() dto: QualityFlagsDto) {
    return this.loans.setQualityFlags(id, dto.qualityFlags);
  }

  @Post(":id/disburse")
  disburse(@Param("id") id: string, @Body() dto: DisburseDto) {
    return this.loans.disburse(id, dto.accountId);
  }

  @Post(":id/repay")
  repay(@Param("id") id: string, @Body() dto: RepayDto, @Req() req: BankAuthRequest) {
    return this.loans.repay(
      id,
      BigInt(dto.amountMinor),
      req.userId ?? "service",
      dto.idempotencyKey,
    );
  }

  @Post(":id/prepay")
  prepay(@Param("id") id: string, @Body() dto: PrepayDto, @Req() req: BankAuthRequest) {
    return this.loans.prepay(
      id,
      {
        amountMinor: BigInt(dto.amountMinor),
        mode: dto.mode,
        idempotencyKey: dto.idempotencyKey,
      },
      req.userId ?? "service",
    );
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
