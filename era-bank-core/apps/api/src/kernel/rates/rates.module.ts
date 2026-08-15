import { Module } from "@nestjs/common";
import { RateIndexService } from "./rate-index.service";

@Module({
  providers: [RateIndexService],
  exports: [RateIndexService],
})
export class RatesModule {}
