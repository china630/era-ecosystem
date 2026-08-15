import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { FatcaCrsClass } from "@era/bank-core-database";
import type { Response } from "express";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { RegReportingService } from "./regreporting.service";

class GenerateCbarDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;
}

class FatcaClassificationDto {
  @IsEnum(FatcaCrsClass)
  classification!: FatcaCrsClass;

  @IsOptional()
  @IsString()
  tinStatus?: string;
}

@ApiTags("reports")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_regreporting")
@Controller("reports")
export class RegReportingController {
  constructor(private readonly regReporting: RegReportingService) {}

  @Get("cbar/:template")
  cbarPreview(
    @Param("template") template: string,
    @Query("periodFrom") periodFrom: string,
    @Query("periodTo") periodTo: string,
  ) {
    return this.regReporting.generateCbar(
      template,
      new Date(periodFrom),
      new Date(periodTo),
    );
  }

  @Post("cbar/:template/generate")
  generateCbar(@Param("template") template: string, @Body() dto: GenerateCbarDto) {
    return this.regReporting.generateCbar(
      template,
      new Date(dto.periodFrom),
      new Date(dto.periodTo),
    );
  }

  @Get("cbar/runs/:id/export")
  exportRun(
    @Param("id") id: string,
    @Query("format") format: "csv" | "xml" | "json" = "csv",
    @Res() res: Response,
  ) {
    return this.regReporting.exportRun(id, format).then(({ contentType, body }) => {
      res.setHeader("Content-Type", contentType);
      res.send(body);
    });
  }

  @Get("fatca-crs")
  fatcaCrs(@Query("period") period?: string) {
    if (period) {
      return this.regReporting.fatcaCrsReport(new Date(period));
    }
    return this.regReporting.fatcaCrsList();
  }

  @Put("fatca-crs/classifications/:customerId")
  upsertClassification(
    @Param("customerId") customerId: string,
    @Body() dto: FatcaClassificationDto,
  ) {
    return this.regReporting.upsertFatcaClassification(customerId, dto);
  }

  @Post("fatca-crs/classifications/:customerId/advance")
  advanceFatca(
    @Param("customerId") customerId: string,
    @Body() dto: FatcaClassificationDto,
  ) {
    return this.regReporting.advanceFatcaWorkflow(
      customerId,
      dto.classification,
    );
  }

  @Post("large-exposures/generate")
  largeExposures(@Query("asOf") asOf?: string) {
    return this.regReporting.largeExposureReport(
      asOf ? new Date(asOf) : new Date(),
    );
  }
}
