import { Module } from "@nestjs/common";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { InternalRailAdapter } from "./internal-rail.adapter";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StubRailAdapter } from "./stub-rail.adapter";

@Module({
  imports: [PostingEngineModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, InternalRailAdapter, StubRailAdapter],
  exports: [PaymentsService],
})
export class PaymentsModule {}
