import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { IslamicController } from "./islamic.controller";
import { IslamicService } from "./islamic.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [IslamicController],
  providers: [IslamicService],
  exports: [IslamicService],
})
export class IslamicModule {}
