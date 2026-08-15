import { Module } from "@nestjs/common";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { ProductFactoryModule } from "../../kernel/product-factory/product-factory.module";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { RatesModule } from "../../kernel/rates/rates.module";
import { DepositsController } from "./deposits.controller";
import { DepositsService } from "./deposits.service";

@Module({
  imports: [
    PostingEngineModule,
    ProductFactoryModule,
    LedgerModule,
    RatesModule,
  ],
  controllers: [DepositsController],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
