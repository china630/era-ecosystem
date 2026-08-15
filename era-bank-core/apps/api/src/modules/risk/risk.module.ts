import { Module } from "@nestjs/common";
import { LoansModule } from "../loans/loans.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { RiskController } from "./risk.controller";
import { RiskService } from "./risk.service";
import { LiquidityRatioService } from "./liquidity-ratio.service";
import { CapitalService } from "./capital.service";
import { IrrbbService, OpRiskService } from "./risk-deep.service";

@Module({
  imports: [LoansModule, PostingEngineModule, LedgerModule],
  controllers: [RiskController],
  providers: [
    RiskService,
    LiquidityRatioService,
    CapitalService,
    IrrbbService,
    OpRiskService,
  ],
  exports: [RiskService, LiquidityRatioService, CapitalService],
})
export class RiskModule {}
