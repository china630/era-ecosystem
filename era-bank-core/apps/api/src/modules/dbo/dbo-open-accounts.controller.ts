import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankOrgConfig } from "../../common/bank-org.config";
import { PrismaService } from "../../prisma/prisma.service";
import { signCustomerJwt, verifyCustomerJwt } from "./dbo-crypto.util";
import { DboOpenApiService } from "./dbo-open-api.service";
import { OpenApiGuard, type OpenApiRequest } from "./open-api.guard";

@ApiTags("dbo-open")
@UseGuards(BankAuthGuard, BankingModuleGuard, OpenApiGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/open/accounts")
export class DboOpenAccountsController {
  constructor(
    private readonly openApi: DboOpenApiService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  private async authFromKey(req: OpenApiRequest) {
    const key = req.openApiKey!;
    const accounts = await this.prisma.account.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: key.customerId,
        status: "ACTIVE",
      },
    });
    const secret = this.config.get<string>("BANK_DBO_JWT_SECRET") ?? "";
    const customerJwt = signCustomerJwt(
      {
        sub: key.customerId,
        channel: "CORPORATE",
        accountIds: accounts.map((a) => a.id),
      },
      secret,
    );
    const payload = verifyCustomerJwt(customerJwt, secret);
    if (!payload) throw new Error("Failed to mint customer JWT");
    return { payload, accounts };
  }

  /** AIS — account information (lab). */
  @Get()
  async listAccounts(@Req() req: OpenApiRequest) {
    this.openApi.assertPermission(req.openApiKey!, "accounts:read");
    const { accounts } = await this.authFromKey(req);
    return accounts.map((a) => ({
      id: a.id,
      iban: a.iban,
      currency: a.currency,
      status: a.status,
      ledgerBalanceMinor: a.ledgerBalanceMinor.toString(),
      availableBalanceMinor: a.availableBalanceMinor.toString(),
    }));
  }

  @Get("consents")
  async listConsents(@Req() req: OpenApiRequest) {
    this.openApi.assertPermission(req.openApiKey!, "accounts:read");
    return this.prisma.openBankingConsent.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: req.openApiKey!.customerId,
      },
    });
  }
}
