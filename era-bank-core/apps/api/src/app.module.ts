import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BankCommonModule } from "./common/bank-common.module";
import { HealthController } from "./common/health.controller";
import { IntegrationModule } from "./integration/integration.module";
import { KernelModule } from "./kernel/kernel.module";
import { AmlModule } from "./modules/aml/aml.module";
import { CardsModule } from "./modules/cards/cards.module";
import { DepositsModule } from "./modules/deposits/deposits.module";
import { DboModule } from "./modules/dbo/dbo.module";
import { LoansModule } from "./modules/loans/loans.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { RegReportingModule } from "./modules/regreporting/regreporting.module";
import { TreasuryModule } from "./modules/treasury/treasury.module";
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
    AmlModule,
    RegReportingModule,
    DboModule,
    CardsModule,
    TreasuryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
