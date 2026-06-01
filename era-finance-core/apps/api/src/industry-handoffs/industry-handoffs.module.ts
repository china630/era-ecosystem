import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { InventoryModule } from "../inventory/inventory.module";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { IndustryHandoffsInventoryController } from "./industry-handoffs-inventory.controller";
import { IndustryHandoffsLogisticsController } from "./industry-handoffs-logistics.controller";
import { IndustryHandoffsPurchasesController } from "./industry-handoffs-purchases.controller";
import { IndustryHandoffsInsuranceController } from "./industry-handoffs-insurance.controller";

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [
    IndustryHandoffsInventoryController,
    IndustryHandoffsLogisticsController,
    IndustryHandoffsPurchasesController,
    IndustryHandoffsInsuranceController,
  ],
  providers: [IndustryHandoffsService],
  exports: [IndustryHandoffsService],
})
export class IndustryHandoffsModule {}
