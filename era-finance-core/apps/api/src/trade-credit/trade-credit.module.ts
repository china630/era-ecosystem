import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TaxModule } from "../tax/tax.module";
import { TradeCreditBuyerController } from "./trade-credit-buyer.controller";
import { TradeCreditController } from "./trade-credit.controller";
import { TradeCreditInternalController } from "./trade-credit-internal.controller";
import { TradeCreditMeterService } from "./trade-credit-meter.service";
import { TradeCreditPhase2Service } from "./trade-credit-phase2.service";
import { TradeCreditPolicyService } from "./trade-credit-policy.service";
import { TradeCreditService } from "./trade-credit.service";
import { BuyerSessionGuard } from "./buyer-session.guard";

@Module({
  imports: [PrismaModule, BillingModule, TaxModule],
  controllers: [
    TradeCreditController,
    TradeCreditInternalController,
    TradeCreditBuyerController,
  ],
  providers: [
    TradeCreditService,
    TradeCreditPolicyService,
    TradeCreditMeterService,
    TradeCreditPhase2Service,
    BuyerSessionGuard,
  ],
  exports: [
    TradeCreditService,
    TradeCreditPolicyService,
    TradeCreditMeterService,
    TradeCreditPhase2Service,
  ],
})
export class TradeCreditModule {}
