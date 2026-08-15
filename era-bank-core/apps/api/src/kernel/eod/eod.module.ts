import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TreasuryModule } from "../../modules/treasury/treasury.module";
import { DepositsModule } from "../../modules/deposits/deposits.module";
import { LoansModule } from "../../modules/loans/loans.module";
import { RiskModule } from "../../modules/risk/risk.module";
import { PaymentsModule } from "../../modules/payments/payments.module";
import { CashModule } from "../../modules/cash/cash.module";
import { CollectionsModule } from "../../modules/collections/collections.module";
import { TradeModule } from "../../modules/trade/trade.module";
import { BranchModule } from "../branch/branch.module";
import { EodController } from "./eod.controller";
import { EodService } from "./eod.service";

@Module({
  imports: [
    LedgerModule,
    IntegrationModule,
    TreasuryModule,
    DepositsModule,
    LoansModule,
    RiskModule,
    PaymentsModule,
    CashModule,
    CollectionsModule,
    TradeModule,
    BranchModule,
  ],
  controllers: [EodController],
  providers: [EodService],
  exports: [EodService],
})
export class EodModule {}
