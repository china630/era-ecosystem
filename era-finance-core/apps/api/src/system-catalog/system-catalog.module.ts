import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { BankingModule } from "../banking/banking.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MoneyAccountsController } from "./money-accounts.controller";
import { SystemCatalogController } from "./system-catalog.controller";

@Module({
  imports: [PrismaModule, BankingModule, AccountingModule],
  controllers: [SystemCatalogController, MoneyAccountsController],
})
export class SystemCatalogModule {}