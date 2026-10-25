import { Module, forwardRef } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { FinanceModule } from "../finance/finance.module";
import { FixedAssetsModule } from "../fixed-assets/fixed-assets.module";
import { IntangibleAssetsModule } from "../intangible-assets/intangible-assets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SignatureModule } from "../signature/signature.module";
import { StorageModule } from "../storage/storage.module";
import { FactQueueController } from "./fact-queue.controller";
import { FactQueueService } from "./fact-queue.service";
import { ReportingController } from "./reporting.controller";
import { SchemePeriodController } from "./scheme-period.controller";
import { SchemePeriodService } from "./scheme-period.service";
import { ReportingService } from "./reporting.service";
import { ETaxesIntegrationService } from "./etaxes-integration.service";
import { TaxExportService } from "./tax-export.service";
import { SimplifiedTaxWatchService } from "./simplified-tax-watch.service";
import { ProfitTaxService } from "./profit-tax.service";
import { PropertyTaxService } from "./property-tax.service";
import { VatAppendixExportService } from "./vat-appendix-export.service";
import { VatQuarterDataService } from "./vat-quarter-data.service";
import { StandardReportsService } from "./standard-reports.service";
import { StatformsController } from "./statforms.controller";
import { StatformsService } from "./statforms.service";
import {
  EtaxesSubmissionAdapterFactory,
  HttpEtaxesSubmissionAdapter,
  HsmEtaxesSubmissionAdapter,
} from "./etaxes-submission.adapters";
import { SystemConfigModule } from "../system-config/system-config.module";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AccountingModule),
    FixedAssetsModule,
    IntangibleAssetsModule,
    FinanceModule,
    SystemConfigModule,
    SignatureModule,
    StorageModule,
  ],
  controllers: [ReportingController, StatformsController, FactQueueController, SchemePeriodController],
  providers: [
    ReportingService,
    FactQueueService,
    SchemePeriodService,
    StandardReportsService,
    VatQuarterDataService,
    VatAppendixExportService,
    ETaxesIntegrationService,
    TaxExportService,
    SimplifiedTaxWatchService,
    ProfitTaxService,
    PropertyTaxService,
    StatformsService,
    HttpEtaxesSubmissionAdapter,
    HsmEtaxesSubmissionAdapter,
    EtaxesSubmissionAdapterFactory,
  ],
  exports: [
    ReportingService,
    FactQueueService,
    SchemePeriodService,
    StandardReportsService,
    EtaxesSubmissionAdapterFactory,
    ETaxesIntegrationService,
  ],
})
export class ReportingModule {}
