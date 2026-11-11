import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { IslamicService } from "../islamic/islamic.service";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";

@ApiTags("dbo-islamic")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/islamic/contracts")
export class DboIslamicController {
  constructor(private readonly islamic: IslamicService) {}

  @Get()
  list(@Req() req: BankCustomerRequest) {
    return this.islamic.listForCustomer(req.customerAuth.sub);
  }
}
