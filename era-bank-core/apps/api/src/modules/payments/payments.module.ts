import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { AmlModule } from "../aml/aml.module";
import { InternalRailAdapter } from "./internal-rail.adapter";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StubRailAdapter } from "./stub-rail.adapter";
import { StandingOrdersService } from "./standing-orders.service";
import { CashPaymentsController } from "./cash-payments.controller";
import {
  ChequesService,
  NostroStatementImportService,
  SweepService,
  VirtualAccountsService,
} from "./cash-payments.service";

@Module({
  imports: [LedgerModule, PostingEngineModule, AmlModule],
  controllers: [PaymentsController, CashPaymentsController],
  providers: [
    PaymentsService,
    InternalRailAdapter,
    StubRailAdapter,
    StandingOrdersService,
    VirtualAccountsService,
    ChequesService,
    SweepService,
    NostroStatementImportService,
  ],
  exports: [PaymentsService, StandingOrdersService],
})
export class PaymentsModule {}
