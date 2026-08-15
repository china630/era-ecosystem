import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { AmlAlertStatus, AmlCaseStatus, AmlSeverity } from "@era/bank-core-database";
import type { Response } from "express";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { AmlService } from "./aml.service";

class ScreenDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  listSource?: string;

  @IsOptional()
  @IsString()
  alertId?: string;
}

class FmnReportDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alertIds?: string[];

  @IsOptional()
  @IsString()
  filedByUserId?: string;
}

class PatchAlertDto {
  @IsOptional()
  @IsEnum(AmlAlertStatus)
  status?: AmlAlertStatus;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

class EscalateDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

class UpdateRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  paramsJson?: Record<string, unknown>;
}

class CreateCaseDto {
  @IsOptional()
  @IsString()
  alertId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  sarDraft?: string;
}

class UpdateCaseDto {
  @IsEnum(AmlCaseStatus)
  status!: AmlCaseStatus;

  @IsOptional()
  @IsString()
  sarDraft?: string;

  @IsOptional()
  @IsObject()
  sarDraftFields?: Record<string, unknown>;
}

class BatchScreenDto {
  @IsArray()
  @IsString({ each: true })
  names!: string[];

  @IsOptional()
  @IsString()
  listSource?: string;
}

class PepFlagDto {
  @IsBoolean()
  pepFlag!: boolean;
}

class FraudScoreDto {
  @IsString()
  reference!: string;

  @IsString()
  channel!: string;

  @IsString()
  amountMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsBoolean()
  muleSuspectFlag?: boolean;
}

@ApiTags("aml")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_aml")
@Controller("aml")
export class AmlController {
  constructor(private readonly aml: AmlService) {}

  @Get("alerts")
  alerts(
    @Query("status") status?: AmlAlertStatus,
    @Query("severity") severity?: AmlSeverity,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.aml.listAlerts({
      status,
      severity,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get("alerts/:id")
  alertDetail(@Param("id") id: string) {
    return this.aml.getAlert(id);
  }

  @Patch("alerts/:id")
  patchAlert(@Param("id") id: string, @Body() dto: PatchAlertDto) {
    return this.aml.patchAlert(id, dto);
  }

  @Post("alerts/:id/escalate")
  escalate(@Param("id") id: string, @Body() dto: EscalateDto) {
    return this.aml.escalateAlert(id, dto.resolutionNote);
  }

  @Get("rules")
  rules() {
    return this.aml.listRules();
  }

  @Put("rules/:code")
  updateRule(@Param("code") code: string, @Body() dto: UpdateRuleDto) {
    return this.aml.updateRule(code, dto);
  }

  @Post("screen/batch")
  screenBatch(@Body() dto: BatchScreenDto) {
    return this.aml.screenBatch(dto.names, dto.listSource);
  }

  @Patch("customers/:customerId/pep")
  updatePep(@Param("customerId") customerId: string, @Body() dto: PepFlagDto) {
    return this.aml.updatePepFlag(customerId, dto.pepFlag);
  }

  @Post("customers/:customerId/ml-score/refresh")
  refreshMl(@Param("customerId") customerId: string) {
    return this.aml.refreshMlScore(customerId);
  }

  @Post("screen")
  screen(@Body() dto: ScreenDto) {
    return this.aml.screen(dto);
  }

  @Post("reports/fmn")
  fmn(@Body() dto: FmnReportDto) {
    return this.aml.createFmnReport({
      periodFrom: new Date(dto.periodFrom),
      periodTo: new Date(dto.periodTo),
      alertIds: dto.alertIds,
      filedByUserId: dto.filedByUserId,
    });
  }

  @Get("reports/fmn/:id/export")
  exportFmn(
    @Param("id") id: string,
    @Query("format") format: "json" | "xml" = "json",
    @Res() res: Response,
  ) {
    return this.aml.exportFmnReport(id, format).then(({ contentType, body }) => {
      res.setHeader("Content-Type", contentType);
      res.send(body);
    });
  }

  @Get("cases")
  cases(@Query("status") status?: AmlCaseStatus) {
    return this.aml.listCases(status);
  }

  @Get("cases/:id")
  caseDetail(@Param("id") id: string) {
    return this.aml.getCase(id);
  }

  @Post("cases")
  createCase(@Body() dto: CreateCaseDto) {
    return this.aml.createCase(dto);
  }

  @Patch("cases/:id")
  patchCase(@Param("id") id: string, @Body() dto: UpdateCaseDto) {
    return this.aml.updateCaseStatus(
      id,
      dto.status,
      dto.sarDraft,
      dto.sarDraftFields,
    );
  }

  @Post("fraud/score")
  fraudScore(@Body() dto: FraudScoreDto) {
    return this.aml.scoreFraud({
      reference: dto.reference,
      channel: dto.channel,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      deviceId: dto.deviceId,
      muleSuspectFlag: dto.muleSuspectFlag,
    });
  }
}
