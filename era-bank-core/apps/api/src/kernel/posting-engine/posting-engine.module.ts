import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PostingEngineController } from "./posting-engine.controller";
import { PostingEngineService } from "./posting-engine.service";
import { TellerPostingService } from "./teller-posting.service";

@Module({
  imports: [AuditModule, LedgerModule],
  controllers: [PostingEngineController],
  providers: [PostingEngineService, TellerPostingService],
  exports: [PostingEngineService, TellerPostingService],
})
export class PostingEngineModule {}
