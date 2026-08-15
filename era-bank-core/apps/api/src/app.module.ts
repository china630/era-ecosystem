import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BankCommonModule } from "./common/bank-common.module";
import { HealthController } from "./common/health.controller";
import { IntegrationModule } from "./integration/integration.module";
import { KernelModule } from "./kernel/kernel.module";
import { AmlModule } from "./modules/aml/aml.module";
import { AtmModule } from "./modules/atm/atm.module";
import { CardsModule } from "./modules/cards/cards.module";
import { CashModule } from "./modules/cash/cash.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { DepositsModule } from "./modules/deposits/deposits.module";
import { DboModule } from "./modules/dbo/dbo.module";
import { FeeModule } from "./modules/fee/fee.module";
import { IslamicModule } from "./modules/islamic/islamic.module";
import { LoansModule } from "./modules/loans/loans.module";
import { MarketsModule } from "./modules/markets/markets.module";
import { MultiEntityModule } from "./modules/multi-entity/multi-entity.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PensionModule } from "./modules/pension/pension.module";
import { PlatformExtrasModule } from "./modules/platform-extras/platform-extras.module";
import { PsaModule } from "./modules/psa/psa.module";
import { RegReportingModule } from "./modules/regreporting/regreporting.module";
import { TradeModule } from "./modules/trade/trade.module";
import { TreasuryModule } from "./modules/treasury/treasury.module";
import { RiskModule } from "./modules/risk/risk.module";
import { WealthModule } from "./modules/wealth/wealth.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    BankCommonModule,
    AuthModule,
    IntegrationModule,
    KernelModule,
    PaymentsModule,
    DepositsModule,
    LoansModule,
    RiskModule,
    AmlModule,
    RegReportingModule,
    DboModule,
    CardsModule,
    AtmModule,
    TreasuryModule,
    FeeModule,
    CashModule,
    CollectionsModule,
    TradeModule,
    IslamicModule,
    WealthModule,
    MarketsModule,
    PensionModule,
    PsaModule,
    MultiEntityModule,
    PlatformExtrasModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
