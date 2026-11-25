import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { MisService } from "./mis.service";

class AssembleMisDto {
  @IsString()
  reportCode!: string;

  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsIn(["json", "csv"])
  format?: "json" | "csv";
}

@ApiTags("mis")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("mis")
export class MisController {
  constructor(private readonly mis: MisService) {}

  @Get("report-keys")
  listReportKeys() {
    return this.mis.listAvailableReportKeys();
  }

  @Post("assemble")
  assemble(@Body() body: AssembleMisDto) {
    return this.mis.assembleReport({
      reportCode: body.reportCode,
      asOf: body.asOf ? new Date(body.asOf) : undefined,
      format: body.format,
    });
  }
}