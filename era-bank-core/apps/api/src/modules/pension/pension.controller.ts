import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { PensionService } from "./pension.service";

class ContributionDto {
  @IsString() customerId!: string;
  @IsString() employerRef!: string;
  @IsString() amountMinor!: string;
  @IsString() periodMonth!: string;
  @IsOptional() @IsString() currency?: string;
}

@ApiTags("pension")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_pension")
@Controller("pension")
export class PensionController {
  constructor(private readonly pension: PensionService) {}

  @Get("contributions")
  list() {
    return this.pension.listContributions();
  }

  @Post("contributions")
  create(@Body() body: ContributionDto) {
    return this.pension.createContribution(body);
  }

  @Post("contributions/:id/post")
  post(@Param("id") id: string) {
    return this.pension.postContribution(id);
  }
}
