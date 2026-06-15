import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TreasuryModule } from "../../modules/treasury/treasury.module";
import { EodController } from "./eod.controller";
import { EodService } from "./eod.service";

@Module({
  imports: [LedgerModule, IntegrationModule, TreasuryModule],  controllers: [EodController],
  providers: [EodService],
  exports: [EodService],
})
export class EodModule {}
