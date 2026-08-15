import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { AtmService } from "./atm.service";

class CreateTerminalDto {
  @IsString() terminalId!: string;
  @IsString() branchId!: string;
  @IsString() locationName!: string;
}

class AuthorizeTxnDto {
  @IsString() atmTerminalId!: string;
  @IsString() amountMinor!: string;
  @IsString() txnType!: string;
  @IsOptional() @IsString() cardId?: string;
}

@ApiTags("atm")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_cards")
@Controller("atm")
export class AtmController {
  constructor(private readonly atm: AtmService) {}

  @Get("terminals")
  listTerminals() {
    return this.atm.listTerminals();
  }

  @Post("terminals")
  createTerminal(@Body() body: CreateTerminalDto) {
    return this.atm.createTerminal(body);
  }

  @Get("txns")
  listTxns() {
    return this.atm.listTxns();
  }

  @Post("txns/authorize")
  authorize(@Body() body: AuthorizeTxnDto) {
    return this.atm.authorizeTxn(body);
  }

  @Get("scheme/outbox")
  schemeOutbox() {
    return this.atm.listSchemeOutbox();
  }
}
