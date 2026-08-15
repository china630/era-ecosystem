import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AsanSimaStubAdapter } from "../../integration/asan-sima-stub.adapter";
import { IntegrationModule } from "../../integration/integration.module";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { AmlModule } from "../aml/aml.module";
import { CardsModule } from "../cards/cards.module";
import { DboCardsController } from "./dbo-cards.controller";
import { LoansModule } from "../loans/loans.module";
import { PaymentsModule } from "../payments/payments.module";
import { BankCustomerAuthGuard } from "./bank-customer-auth.guard";
import { DboAccountsController } from "./dbo-accounts.controller";
import { DboAccountsService } from "./dbo-accounts.service";
import { DboAuthController } from "./dbo-auth.controller";
import { DboAuthService } from "./dbo-auth.service";
import { DboController } from "./dbo.controller";
import { DboIslamicController } from "./dbo-islamic.controller";
import { DboLoanApplicationsController } from "./dbo-loan-applications.controller";
import { DboOpenController } from "./dbo-open.controller";
import { DboOpenAccountsController } from "./dbo-open-accounts.controller";
import { DboOpenApiService } from "./dbo-open-api.service";
import { DboPaymentsController } from "./dbo-payments.controller";
import { DboPaymentsService } from "./dbo-payments.service";
import { DboService } from "./dbo.service";
import { DboOpsController } from "./dbo-ops.controller";
import { DboOpsService } from "./dbo-ops.service";
import { DboStandingOrdersController } from "./dbo-standing-orders.controller";
import { DboStandingOrdersService } from "./dbo-standing-orders.service";
import { DboThreeDsController } from "./dbo-3ds.controller";
import { OpenApiGuard } from "./open-api.guard";

@Module({
  imports: [
    ConfigModule,
    IntegrationModule,
    LedgerModule,
    PostingEngineModule,
    PaymentsModule,
    LoansModule,
    AmlModule,
    CardsModule,
  ],
  controllers: [
    DboController,
    DboAuthController,
    DboAccountsController,
    DboPaymentsController,
    DboStandingOrdersController,
    DboLoanApplicationsController,
    DboThreeDsController,
    DboIslamicController,
    DboOpenController,
    DboOpenAccountsController,
    DboCardsController,
    DboOpsController,
  ],
  providers: [
    DboService,
    DboOpsService,
    DboAuthService,
    DboAccountsService,
    DboPaymentsService,
    DboStandingOrdersService,
    DboOpenApiService,
    BankCustomerAuthGuard,
    OpenApiGuard,
    AsanSimaStubAdapter,
  ],
  exports: [DboService, DboAuthService],
})
export class DboModule {}
