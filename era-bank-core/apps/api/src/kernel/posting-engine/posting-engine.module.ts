import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PostingEngineController } from "./posting-engine.controller";
import { PostingEngineService } from "./posting-engine.service";
import { TellerPostingService } from "./teller-posting.service";

@Module({
  imports: [AuditModule],
  controllers: [PostingEngineController],
  providers: [PostingEngineService, TellerPostingService],
  exports: [PostingEngineService],
})
export class PostingEngineModule {}
