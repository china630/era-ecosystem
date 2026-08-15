import { Module } from "@nestjs/common";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { ProductFactoryModule } from "../../kernel/product-factory/product-factory.module";
import { RatesModule } from "../../kernel/rates/rates.module";
import { LoansController } from "./loans.controller";
import { LoansDeepController } from "./loans-deep.controller";
import { LoansDeepService } from "./loans-deep.service";
import { LoansService } from "./loans.service";

@Module({
  imports: [PostingEngineModule, ProductFactoryModule, RatesModule],
  controllers: [LoansDeepController, LoansController],
  providers: [LoansService, LoansDeepService],
  exports: [LoansService, LoansDeepService],
})
export class LoansModule {}
