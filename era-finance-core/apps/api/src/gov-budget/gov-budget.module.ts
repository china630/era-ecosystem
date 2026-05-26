import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { GovBudgetController } from "./gov-budget.controller";
import { GovBudgetService } from "./gov-budget.service";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [GovBudgetController],
  providers: [GovBudgetService],
  exports: [GovBudgetService],
})
export class GovBudgetModule {}
