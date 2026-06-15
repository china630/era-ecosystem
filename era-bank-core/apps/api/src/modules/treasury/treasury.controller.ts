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
import { NostroDirection } from "@era/bank-core-database";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { TreasuryService } from "./treasury.service";

class NostroRegisterDto {
  @IsEnum(NostroDirection)
  direction!: NostroDirection;

  @IsString()
  iban!: string;

  @IsString()
  currency!: string;

  @IsString()
  glAccountCode!: string;

  @IsOptional()
  @IsString()
  counterpartyId?: string;
}

class ReconcileDto {
  @IsString()
  statementBalanceMinor!: string;
}

class FxDealDto {
  @IsString()
  baseCurrency!: string;

  @IsString()
  quoteCurrency!: string;

  @IsString()
  baseAmountMinor!: string;

  @IsString()
  quoteAmountMinor!: string;

  @IsNumber()
  rate!: number;

  @IsDateString()
  valueDate!: string;

  @IsString()
  idempotencyKey!: string;
}

class InterbankDto {
  @IsString()
  counterpartyId!: string;

  @IsString()
  nostroAccountId!: string;

  @IsString()
  principalMinor!: string;

  @IsString()
  currency!: string;

  @IsNumber()
  rateAnnual!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  maturityDate!: string;

  @IsString()
  idempotencyKey!: string;
}

class GovSecurityDto {
  @IsString()
  isin!: string;

  @IsString()
  faceValueMinor!: string;

  @IsString()
  bookValueMinor!: string;

  @IsString()
  currency!: string;

  @IsDateString()
  maturityDate!: string;

  @IsString()
  idempotencyKey!: string;
}

@ApiTags("treasury")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_treasury")
@Controller("treasury")
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get("nostro-vostro")
  nostroVostro() {
    return this.treasury.listNostroVostro();
  }

  @Post("nostro-vostro")
  registerNostro(@Body() dto: NostroRegisterDto) {
    return this.treasury.registerNostroVostro(dto);
  }

  @Get("nostro-vostro/:id/statement")
  nostroStatement(@Param("id") id: string) {
    return this.treasury.nostroStatement(id);
  }

  @Post("nostro-vostro/:id/reconcile")
  reconcile(@Param("id") id: string, @Body() dto: ReconcileDto) {
    return this.treasury.reconcileNostro(id, BigInt(dto.statementBalanceMinor));
  }

  @Get("fx-deals")
  listFxDeals() {
    return this.treasury.listFxDeals();
  }

  @Get("fx-deals/:id")
  getFxDeal(@Param("id") id: string) {
    return this.treasury.getFxDeal(id);
  }

  @Post("fx-deals")
  bookFxDeal(@Body() dto: FxDealDto, @Req() req: BankAuthRequest) {
    return this.treasury.bookFxDeal({
      baseCurrency: dto.baseCurrency,
      quoteCurrency: dto.quoteCurrency,
      baseAmountMinor: BigInt(dto.baseAmountMinor),
      quoteAmountMinor: BigInt(dto.quoteAmountMinor),
      rate: dto.rate,
      valueDate: new Date(dto.valueDate),
      bookedByUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post("fx-deals/:id/settle")
  settleFx(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.treasury.settleFxDeal(id, req.userId ?? "service");
  }

  @Post("fx-deals/:id/cancel")
  cancelFx(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.treasury.cancelFxDeal(id, req.userId ?? "service");
  }

  @Get("fx-rates/suggested")
  suggestedRate(@Query("base") base = "USD", @Query("asOf") asOf?: string) {
    return this.treasury.suggestedFxRate(base, asOf ? new Date(asOf) : new Date());
  }

  @Get("interbank")
  listInterbank() {
    return this.treasury.listInterbank();
  }

  @Post("interbank")
  interbank(@Body() dto: InterbankDto, @Req() req: BankAuthRequest) {
    return this.treasury.placeInterbank({
      counterpartyId: dto.counterpartyId,
      nostroAccountId: dto.nostroAccountId,
      principalMinor: BigInt(dto.principalMinor),
      currency: dto.currency,
      rateAnnual: dto.rateAnnual,
      startDate: new Date(dto.startDate),
      maturityDate: new Date(dto.maturityDate),
      bookedByUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post("interbank/:id/mature")
  matureInterbank(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.treasury.matureInterbank(id, req.userId ?? "service");
  }

  @Get("gov-securities")
  listGovSecurities() {
    return this.treasury.listGovSecurities();
  }

  @Post("gov-securities")
  purchaseGovSecurity(@Body() dto: GovSecurityDto, @Req() req: BankAuthRequest) {
    return this.treasury.purchaseGovSecurity({
      isin: dto.isin,
      faceValueMinor: BigInt(dto.faceValueMinor),
      bookValueMinor: BigInt(dto.bookValueMinor),
      currency: dto.currency,
      maturityDate: new Date(dto.maturityDate),
      bookedByUserId: req.userId ?? "service",
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post("gov-securities/:id/mature")
  matureGovSecurity(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.treasury.matureGovSecurity(id, req.userId ?? "service");
  }

  @Get("liquidity-gap")
  liquidityGap(@Query("asOf") asOf?: string, @Query("horizonDays") horizonDays?: string) {
    return this.treasury.liquidityGap(
      asOf ? new Date(asOf) : new Date(),
      horizonDays ? Number(horizonDays) : 30,
    );
  }

  @Get("liquidity-gap/history")
  gapHistory(@Query("limit") limit?: string) {
    return this.treasury.gapHistory(limit ? Number(limit) : 10);
  }
}
