import { Module } from "@nestjs/common";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { DepositsController } from "./deposits.controller";
import { DepositsService } from "./deposits.service";

@Module({
  imports: [PostingEngineModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
