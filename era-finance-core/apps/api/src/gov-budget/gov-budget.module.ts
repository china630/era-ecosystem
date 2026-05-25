import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { GovBudgetController } from "./gov-budget.controller";
import { GovBudgetService } from "./gov-budget.service";

@Module({
  imports: [PrismaModule],
  controllers: [GovBudgetController],
  providers: [GovBudgetService],
  exports: [GovBudgetService],
})
export class GovBudgetModule {}
