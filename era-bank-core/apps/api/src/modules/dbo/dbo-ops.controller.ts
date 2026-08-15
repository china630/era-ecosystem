import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { H2hJobStatus } from "@era/bank-core-database";
import { IsArray, IsDateString, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { DboOpsService } from "./dbo-ops.service";

class H2hReceiveDto {
  @IsString()
  fileName!: string;

  @IsString()
  payload!: string;
}

class ObConsentDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@ApiTags("dbo")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("dbo")
export class DboOpsController {
  constructor(private readonly ops: DboOpsService) {}

  @Get("h2h/jobs")
  listH2h(@Query("status") status?: H2hJobStatus) {
    return this.ops.listH2hJobs(status);
  }

  @Post("h2h/jobs")
  receiveH2h(@Body() dto: H2hReceiveDto) {
    return this.ops.receiveH2hJob(dto);
  }

  @Post("h2h/jobs/:id/parse")
  parseH2h(@Param("id") id: string) {
    return this.ops.parseH2hJob(id);
  }

  @Get("open-banking/consents")
  listConsents(@Query("customerId") customerId?: string) {
    return this.ops.listObConsents(customerId);
  }

  @Post("open-banking/consents")
  createConsent(@Body() dto: ObConsentDto) {
    return this.ops.createObConsent({
      customerId: dto.customerId,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Post("open-banking/consents/:id/revoke")
  revokeConsent(@Param("id") id: string) {
    return this.ops.revokeObConsent(id);
  }
}
