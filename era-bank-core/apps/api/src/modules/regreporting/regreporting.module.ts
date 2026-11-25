import { Module } from "@nestjs/common";
import { BankCommonModule } from "../../common/bank-common.module";
import { IntegrationModule } from "../../integration/integration.module";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { RegReportingController } from "./regreporting.controller";
import { RegReportingService } from "./regreporting.service";

@Module({
  imports: [BankCommonModule, LedgerModule, IntegrationModule],
  controllers: [RegReportingController],
  providers: [RegReportingService],
})
export class RegReportingModule {}
