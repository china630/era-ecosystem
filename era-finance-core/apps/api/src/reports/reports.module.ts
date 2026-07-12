import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { MailModule } from "../mail/mail.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReportingModule } from "../reporting/reporting.module";
import { SignatureModule } from "../signature/signature.module";
import { CashFlowService } from "./cash-flow.service";
import { FinancialReportService } from "./financial-report.service";
import { MhbsStatementsController } from "./mhbs-statements.controller";
import { MhbsStatementsService } from "./mhbs-statements.service";
import { ReportsCacheService } from "./reports-cache.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [PrismaModule, ReportingModule, MailModule, AccountingModule, SignatureModule],
  controllers: [ReportsController, MhbsStatementsController],
  providers: [ReportsCacheService, CashFlowService, FinancialReportService, MhbsStatementsService],
})
export class ReportsModule {}

