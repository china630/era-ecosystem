import { Module } from "@nestjs/common";
import { PostingEngineModule } from "../posting-engine/posting-engine.module";
import { BranchController } from "./branch.controller";
import { BranchService } from "./branch.service";

@Module({
  imports: [PostingEngineModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}
