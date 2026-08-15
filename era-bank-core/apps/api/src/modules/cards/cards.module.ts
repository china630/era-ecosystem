import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { ProductFactoryModule } from "../../kernel/product-factory/product-factory.module";
import { AmlModule } from "../aml/aml.module";
import { CardTxnsController } from "./card-txns.controller";
import { CardsAcquiringController } from "./cards-acquiring.controller";
import { CardsController } from "./cards.controller";
import { CardsService } from "./cards.service";
import { MockAzeriCardGateway } from "./gateway/mock-azericard.gateway";

@Module({
  imports: [
    LedgerModule,
    PostingEngineModule,
    AmlModule,
    IntegrationModule,
    ProductFactoryModule,
  ],
  controllers: [CardsController, CardTxnsController, CardsAcquiringController],
  providers: [CardsService, MockAzeriCardGateway],
  exports: [CardsService],
})
export class CardsModule {}
