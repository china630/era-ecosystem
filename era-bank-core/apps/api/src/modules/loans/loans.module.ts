import { Module } from "@nestjs/common";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { LoansController } from "./loans.controller";
import { LoansService } from "./loans.service";

@Module({
  imports: [PostingEngineModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
