import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { PostingEngineModule } from "../posting-engine/posting-engine.module";
import { BranchController } from "./branch.controller";
import { BranchService } from "./branch.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}
