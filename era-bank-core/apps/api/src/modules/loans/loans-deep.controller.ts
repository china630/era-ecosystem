import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LoanApplicationStatus, ForbearanceStage } from "@era/bank-core-database";
import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { LoansDeepService } from "./loans-deep.service";

class ApplicationDto {
  @IsString()
  customerId!: string;

  @IsString()
  productTemplateId!: string;

  @IsString()
  requestedMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

class CreditLineDto {
  @IsString()
  customerId!: string;

  @IsString()
  productTemplateId!: string;

  @IsString()
  limitMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  participationPct?: number;

  @IsOptional()
  @IsString()
  leadBankName?: string;
}

class DrawdownDto {
  @IsString()
  creditLineId!: string;

  @IsString()
  amountMinor!: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  idempotencyKey!: string;
}

class ScoreDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  applicationId?: string;
}

class ValuationDto {
  @IsString()
  loanId!: string;

  @IsString()
  amountMinor!: string;

  @IsDateString()
  valuedAt!: string;

  @IsOptional()
  @IsString()
  valuerNote?: string;
}

class LienDto {
  @IsString()
  loanId!: string;

  @IsString()
  lienRef!: string;

  @IsString()
  description!: string;

  @IsString()
  amountMinor!: string;

  @IsDateString()
  registeredAt!: string;
}

class ForbearanceDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsEnum(ForbearanceStage)
  stage?: ForbearanceStage;
}

class ForbearanceStageDto {
  @IsEnum(ForbearanceStage)
  stage!: ForbearanceStage;
}

class CreditPolicyDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsObject()
  rulesJson!: Record<string, unknown>;
}

@ApiTags("loans")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("loans")
export class LoansDeepController {
  constructor(private readonly deep: LoansDeepService) {}

  @Get("applications")
  listApplications(@Query("status") status?: LoanApplicationStatus) {
    return this.deep.listApplications(status);
  }

  @Post("applications")
  createApplication(@Body() dto: ApplicationDto, @Req() req: BankAuthRequest) {
    return this.deep.createApplication({
      ...dto,
      requestedMinor: BigInt(dto.requestedMinor),
      makerUserId: req.userId ?? "service",
    });
  }

  @Post("applications/:id/submit")
  submitApplication(@Param("id") id: string) {
    return this.deep.submitApplication(id);
  }

  @Post("applications/:id/approve")
  approveApplication(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.deep.approveApplication(id, req.userId ?? "service");
  }

  @Patch("applications/:id/forbearance")
  forbearance(@Param("id") id: string, @Body() dto: ForbearanceDto) {
    return this.deep.setForbearance(id, dto.reason, dto.stage);
  }

  @Patch("applications/:id/forbearance/stage")
  forbearanceStage(@Param("id") id: string, @Body() dto: ForbearanceStageDto) {
    return this.deep.advanceForbearanceStage(id, dto.stage);
  }

  @Get("credit-policy/rules")
  listCreditPolicy() {
    return this.deep.listCreditPolicyRules();
  }

  @Post("credit-policy/rules")
  upsertCreditPolicy(@Body() dto: CreditPolicyDto) {
    return this.deep.upsertCreditPolicyRule({
      code: dto.code,
      name: dto.name,
      rulesJson: dto.rulesJson as never,
    });
  }

  @Get("credit-lines")
  listCreditLines(@Query("customerId") customerId?: string) {
    return this.deep.listCreditLines(customerId);
  }

  @Post("credit-lines")
  createCreditLine(@Body() dto: CreditLineDto) {
    return this.deep.createCreditLine({
      ...dto,
      limitMinor: BigInt(dto.limitMinor),
    });
  }

  @Post("drawdowns")
  requestDrawdown(@Body() dto: DrawdownDto, @Req() req: BankAuthRequest) {
    return this.deep.requestDrawdown({
      creditLineId: dto.creditLineId,
      amountMinor: BigInt(dto.amountMinor),
      accountId: dto.accountId,
      idempotencyKey: dto.idempotencyKey,
      makerUserId: req.userId ?? "service",
    });
  }

  @Post("drawdowns/:id/approve")
  approveDrawdown(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.deep.approveDrawdown(id, req.userId ?? "service");
  }

  @Post("drawdowns/:id/disburse")
  disburseDrawdown(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.deep.disburseDrawdown(id, req.userId ?? "service");
  }

  @Post("score")
  score(@Body() dto: ScoreDto) {
    return this.deep.score(dto.customerId, dto.applicationId);
  }

  @Post("collateral-valuations")
  valuation(@Body() dto: ValuationDto) {
    return this.deep.recordCollateralValuation({
      loanId: dto.loanId,
      amountMinor: BigInt(dto.amountMinor),
      valuedAt: new Date(dto.valuedAt),
      valuerNote: dto.valuerNote,
    });
  }

  @Post("liens")
  registerLien(@Body() dto: LienDto) {
    return this.deep.registerLien({
      loanId: dto.loanId,
      lienRef: dto.lienRef,
      description: dto.description,
      amountMinor: BigInt(dto.amountMinor),
      registeredAt: new Date(dto.registeredAt),
    });
  }

  @Post("liens/:ref/release")
  releaseLien(@Param("ref") ref: string) {
    return this.deep.releaseLien(ref);
  }
}
