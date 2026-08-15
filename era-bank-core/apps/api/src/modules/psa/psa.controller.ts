import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { PsaService } from "./psa.service";

class TsaAccountDto {
  @IsString() agencyCode!: string;
  @IsString() accountNo!: string;
  @IsString() treasuryCode!: string;
}

@ApiTags("psa")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_psa")
@Controller("psa")
export class PsaController {
  constructor(private readonly psa: PsaService) {}

  @Get("tsa-accounts")
  list() {
    return this.psa.listAccounts();
  }

  @Post("tsa-accounts")
  create(@Body() body: TsaAccountDto) {
    return this.psa.createAccount(body);
  }
}
