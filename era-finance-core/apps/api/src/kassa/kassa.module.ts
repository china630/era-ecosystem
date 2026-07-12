import { Module, forwardRef } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { AccountingModule } from "../accounting/accounting.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { FxModule } from "../fx/fx.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReportingModule } from "../reporting/reporting.module";
import { TreasuryModule } from "../treasury/treasury.module";
import { AdvanceReportService } from "./advance-report.service";
import { CashDeskController } from "./cash-desk.controller";
import { CashOrderService } from "./cash-order.service";

@Module({
  imports: [
    PrismaModule,
    AccountingModule,
    ReportingModule,
    TreasuryModule,
    ApprovalsModule,
    FxModule,
    forwardRef(() => ComplianceModule),
  ],
  controllers: [CashDeskController],
  providers: [CashOrderService, AdvanceReportService],
  exports: [CashOrderService, AdvanceReportService],
})
export class KassaModule {}
