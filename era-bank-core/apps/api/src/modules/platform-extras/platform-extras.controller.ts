import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { PlatformExtrasService } from "./platform-extras.service";

class MisJobDto {
  @IsString() reportCode!: string;
  @IsOptional() paramsJson?: Record<string, unknown>;
}

class BpmDto {
  @IsString() processCode!: string;
  @IsString() name!: string;
  @IsOptional() stepsJson?: unknown[];
}

class DmsDto {
  @IsString() documentRef!: string;
  @IsString() category!: string;
  @IsString() title!: string;
  @IsOptional() metadataJson?: Record<string, unknown>;
}

@ApiTags("platform-extras")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_core")
@Controller("platform-extras")
export class PlatformExtrasController {
  constructor(private readonly extras: PlatformExtrasService) {}

  @Get("mis/jobs")
  listMis() {
    return this.extras.listMisJobs();
  }

  @Post("mis/jobs")
  createMis(@Body() body: MisJobDto) {
    return this.extras.createMisJob(body);
  }

  @Post("mis/jobs/:id/complete")
  completeMis(@Param("id") id: string) {
    return this.extras.completeMisJob(id);
  }

  @Get("bpm/processes")
  listBpm() {
    return this.extras.listBpmProcesses();
  }

  @Post("bpm/processes")
  createBpm(@Body() body: BpmDto) {
    return this.extras.createBpmProcess(body);
  }

  @Get("dms/documents")
  listDms() {
    return this.extras.listDmsDocuments();
  }

  @Post("dms/documents")
  createDms(@Body() body: DmsDto) {
    return this.extras.createDmsDocument(body);
  }
}
