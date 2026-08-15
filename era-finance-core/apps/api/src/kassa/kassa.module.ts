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
import { CashOrderSubtypesController } from "./cash-order-subtypes.controller";
import { CashOrderSubtypesService } from "./cash-order-subtypes.service";

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
  controllers: [CashDeskController, CashOrderSubtypesController],
  providers: [CashOrderService, AdvanceReportService, CashOrderSubtypesService],
  exports: [CashOrderService, AdvanceReportService, CashOrderSubtypesService],
})
export class KassaModule {}
