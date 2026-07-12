import { Module } from "@nestjs/common";
import { DataHubModule } from "../data-hub/data-hub.module";
import { AccountingModule } from "../accounting/accounting.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { FxModule } from "../fx/fx.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CustomsController } from "./customs.controller";
import { CustomsService } from "./customs.service";
import { CustomsTaxCalculatorService } from "./customs-tax-calculator.service";
import { LandedCostService } from "./landed-cost.service";
import { ImportPipelineService } from "./import-pipeline.service";

@Module({
  imports: [
    DataHubModule,
    AccountingModule,
    IntegrationsModule,
    CounterpartiesModule,
    FxModule,
    InventoryModule,
  ],
  controllers: [CustomsController],
  providers: [
    CustomsService,
    CustomsTaxCalculatorService,
    LandedCostService,
    ImportPipelineService,
  ],
  exports: [CustomsService, LandedCostService],
})
export class CustomsModule {}
