import { Module, forwardRef } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { BankingModule } from "../banking/banking.module";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AbsenceTypesController } from "./absence-types.controller";
import { AbsenceTypesService } from "./absence-types.service";
import { AbsencesController } from "./absences.controller";
import { AbsencesService } from "./absences.service";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";
import { EmasController } from "./emas.controller";
import { EmasContractService } from "./emas-contract.service";
import {
  EmasSubmissionAdapterFactory,
  HttpEmasSubmissionAdapter,
  HsmEmasSubmissionAdapter,
} from "./emas-submission.adapters";
import { OrgStructureController } from "./org-structure.controller";
import { OrgStructureService } from "./org-structure.service";
import { TimesheetController } from "./timesheet.controller";
import { TimesheetService } from "./timesheet.service";
import { PayrollController } from "./payroll.controller";
import { PayrollHeavyQueueService } from "./payroll-heavy.queue";
import { PayrollHeavyWorker } from "./payroll-heavy.worker";
import { PayrollService } from "./payroll.service";
import { PayrollExportService } from "./payroll-export.service";
import { DepartmentHeadScopeService } from "./department-head-scope.service";
import { NotificationModule } from "../notifications/notification.module";
import { VacationBalanceService } from "./vacation-balance.service";
import { IntegrationsModule } from "../integrations/integrations.module";
import { HrCalendarService } from "./hr-calendar.service";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { HrStaffProvisioningService } from "../integration/hr-staff-provisioning.service";
import { HrRemindersService } from "./hr-reminders.service";
import { EmployeeDocumentsController } from "./employee-documents.controller";
import { EmployeeDocumentsService } from "./employee-documents.service";
import { SystemConfigModule } from "../system-config/system-config.module";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AccountingModule),
    BankingModule,
    NotificationModule,
    IntegrationsModule,
    OrchestratorModule,
    SystemConfigModule,
  ],
  controllers: [
    EmployeesController,
    EmasController,
    PayrollController,
    AbsencesController,
    AbsenceTypesController,
    OrgStructureController,
    TimesheetController,
    EmployeeDocumentsController,
  ],
  providers: [
    EmployeesService,
    EmasContractService,
    HttpEmasSubmissionAdapter,
    HsmEmasSubmissionAdapter,
    EmasSubmissionAdapterFactory,
    PayrollHeavyQueueService,
    PayrollHeavyWorker,
    PayrollService,
    PayrollExportService,
    AbsenceTypesService,
    AbsencesService,
    OrgStructureService,
    TimesheetService,
    DepartmentHeadScopeService,
    VacationBalanceService,
    HrCalendarService,
    HrStaffProvisioningService,
    HrRemindersService,
    EmployeeDocumentsService,
    RolesGuard,
  ],
  exports: [OrgStructureService, TimesheetService, AbsenceTypesService],
})
export class HrModule {}
