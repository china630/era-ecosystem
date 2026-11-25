import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { ProductFactoryModule } from "../../kernel/product-factory/product-factory.module";
import { RatesModule } from "../../kernel/rates/rates.module";
import { LoansController } from "./loans.controller";
import { LoansDeepController } from "./loans-deep.controller";
import { LoansDeepService } from "./loans-deep.service";
import { LoansService } from "./loans.service";
import { CreditRegistryService } from "./credit-registry.service";
import { CollateralService } from "./collateral.service";

@Module({
  imports: [
    PostingEngineModule,
    ProductFactoryModule,
    RatesModule,
    IntegrationModule,
  ],
  controllers: [LoansDeepController, LoansController],
  providers: [LoansService, LoansDeepService, CreditRegistryService, CollateralService],
  exports: [LoansService, LoansDeepService, CreditRegistryService, CollateralService],
})
export class LoansModule {}
