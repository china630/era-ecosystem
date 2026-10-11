import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { InventoryModule } from "../inventory/inventory.module";
import { DataHubModule } from "../data-hub/data-hub.module";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { IndustryHandoffsInventoryController } from "./industry-handoffs-inventory.controller";
import { IndustryHandoffsLogisticsController } from "./industry-handoffs-logistics.controller";
import { IndustryHandoffsPurchasesController } from "./industry-handoffs-purchases.controller";
import { IndustryHandoffsInsuranceController } from "./industry-handoffs-insurance.controller";
import { IndustryHandoffsClinicController } from "./industry-handoffs-clinic.controller";

@Module({
  imports: [PrismaModule, InventoryModule, DataHubModule],
  controllers: [
    IndustryHandoffsInventoryController,
    IndustryHandoffsLogisticsController,
    IndustryHandoffsPurchasesController,
    IndustryHandoffsInsuranceController,
    IndustryHandoffsClinicController,
  ],
  providers: [IndustryHandoffsService],
  exports: [IndustryHandoffsService],
})
export class IndustryHandoffsModule {}
