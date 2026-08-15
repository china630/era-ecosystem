import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { TradeController } from "./trade.controller";
import { TradeService } from "./trade.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
