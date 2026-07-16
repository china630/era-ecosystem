import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FinanceModule } from "../finance/finance.module";
import { FixedAssetsModule } from "../fixed-assets/fixed-assets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";
import { ETaxesIntegrationService } from "./etaxes-integration.service";
import { TaxExportService } from "./tax-export.service";
import { ProfitTaxService } from "./profit-tax.service";
import { PropertyTaxService } from "./property-tax.service";
import { PayrollWithholdingService } from "./payroll-withholding.service";
import { VatAppendixExportService } from "./vat-appendix-export.service";
import { VatQuarterDataService } from "./vat-quarter-data.service";
import { StatformsController } from "./statforms.controller";
import { StatformsService } from "./statforms.service";

@Module({
  imports: [PrismaModule, AccountingModule, FixedAssetsModule, FinanceModule],
  controllers: [ReportingController, StatformsController],
  providers: [
    ReportingService,
    VatQuarterDataService,
    VatAppendixExportService,
    ETaxesIntegrationService,
    TaxExportService,
    ProfitTaxService,
    PropertyTaxService,
    PayrollWithholdingService,
    StatformsService,
    RolesGuard,
  ],
  exports: [ReportingService, ProfitTaxService],
})
export class ReportingModule {}
