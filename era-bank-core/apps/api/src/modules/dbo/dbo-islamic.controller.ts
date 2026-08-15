import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";

@ApiTags("dbo-islamic")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/islamic/contracts")
export class DboIslamicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  @Get()
  list(@Req() req: BankCustomerRequest) {
    return this.prisma.islamicContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: req.customerAuth.sub,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
