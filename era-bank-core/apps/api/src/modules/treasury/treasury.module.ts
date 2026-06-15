import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { TreasuryController } from "./treasury.controller";
import { TreasuryService } from "./treasury.service";

@Module({
  imports: [PostingEngineModule, IntegrationModule],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
