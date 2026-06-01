import { Module } from "@nestjs/common";
import { DataHubModule } from "../data-hub/data-hub.module";
import { AccountingModule } from "../accounting/accounting.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { CustomsController } from "./customs.controller";
import { CustomsService } from "./customs.service";
import { CustomsTariffRatesService } from "./customs-tariff-rates.service";
import { CustomsTaxCalculatorService } from "./customs-tax-calculator.service";

@Module({
  imports: [DataHubModule, AccountingModule, IntegrationsModule, CounterpartiesModule],
  controllers: [CustomsController],
  providers: [CustomsService, CustomsTariffRatesService, CustomsTaxCalculatorService],
  exports: [CustomsService, CustomsTariffRatesService],
})
export class CustomsModule {}
