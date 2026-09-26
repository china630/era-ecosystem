import { Module } from "@nestjs/common";

import { MdmModule } from "../../mdm/mdm.module";

import { PrismaModule } from "../../prisma/prisma.module";

import { SatelliteEventsModule } from "../../satellite-events/satellite-events.module";

import { SubscriptionModule } from "../../subscription/subscription.module";

import { PlatformSharedModule } from "../platform-shared.module";

import { WorkforceAbsencesController } from "./workforce-absences.controller";

import { WorkforceAbsencesService } from "./workforce-absences.service";

import { WorkforceAuditService } from "./workforce-audit.service";

import { WorkforceEmploymentsController } from "./workforce-employments.controller";

import { WorkforceEmploymentsService } from "./workforce-employments.service";

import { WorkforceEntitlementService } from "./workforce-entitlement.service";

import { WorkforceManualGrantsController } from "./workforce-manual-grants.controller";

import { WorkforceManualGrantService } from "./workforce-manual-grant.service";

import { WorkforceOrgController } from "./workforce-org.controller";

import { WorkforceOrgScopeService } from "./workforce-org-scope.service";

import { WorkforceOrgUnitsService } from "./workforce-org-units.service";

import { WorkforcePositionsController } from "./workforce-positions.controller";

import { WorkforcePositionsService } from "./workforce-positions.service";

import { WorkforceProvisionService } from "./workforce-provision.service";

import { WorkforceRoleTemplateService } from "./workforce-role-template.service";

import { WorkforceRoleTemplatesController } from "./workforce-role-templates.controller";

import { WorkforceScopeService } from "./workforce-scope.service";

import { WorkforceSeatService } from "./workforce-seat.service";

import { WorkforceSecurityController } from "./workforce-security.controller";

import { WorkforceSecurityService } from "./workforce-security.service";

import { WorkforceExportController } from "./workforce-export.controller";

import { WorkforceExportService } from "./workforce-export.service";

import { WorkforceImportController } from "./workforce-import.controller";

import { WorkforceImportService } from "./workforce-import.service";

import { WorkforceMigrationController } from "./workforce-migration.controller";

import { WorkforceMigrationService } from "./workforce-migration.service";

import { WorkforceTimesheetsController } from "./workforce-timesheets.controller";

import { WorkforceTimesheetsService } from "./workforce-timesheets.service";

import { WorkforceTimesheetSubscriberService } from "./workforce-timesheet-subscriber.service";

import { WorkforceRosterController } from "./workforce-roster.controller";

import { WorkforceRosterService } from "./workforce-roster.service";

import { WorkforceRosterCache } from "./workforce-roster-cache";

import { WorkforceHoldingController } from "./workforce-holding.controller";

import { WorkforceHoldingService } from "./workforce-holding.service";

import { WorkforceVacationPlansController } from "./workforce-vacation-plans.controller";

import { WorkforceVacationPlansService } from "./workforce-vacation-plans.service";

import { WorkforcePersonnelOrdersController, StaffScheduleRevisionsController } from "./workforce-personnel-docs.controller";

import { WorkforcePersonnelOrdersService } from "./workforce-personnel-orders.service";

import { FinanceWorkforceMirrorClient } from "./finance-workforce-mirror.client";

import { StaffScheduleRevisionsService } from "./staff-schedule-revisions.service";

import { LicensingSeatsController } from "./licensing-seats.controller";

import { WorkforceSeatsController } from "./workforce-seats.controller";

import { WorkforceAttendanceController } from "./workforce-attendance.controller";

import { WorkforceAttendanceIngestController } from "./workforce-attendance-ingest.controller";

import { WorkforceAttendanceService } from "./workforce-attendance.service";

import { WorkforceAttendanceCronService } from "./workforce-attendance.cron";



@Module({

  imports: [

    PrismaModule,

    MdmModule,

    SubscriptionModule,

    PlatformSharedModule,

    SatelliteEventsModule,

  ],

  controllers: [

    WorkforceEmploymentsController,

    WorkforceAbsencesController,

    WorkforceOrgController,

    WorkforcePositionsController,

    WorkforceRoleTemplatesController,

    WorkforceManualGrantsController,

    WorkforceSecurityController,

    WorkforceExportController,

    WorkforceImportController,

    WorkforceMigrationController,

    WorkforceTimesheetsController,

    WorkforceRosterController,

    WorkforceHoldingController,

    WorkforceVacationPlansController,

    WorkforcePersonnelOrdersController,

    StaffScheduleRevisionsController,

    LicensingSeatsController,

    WorkforceSeatsController,

    WorkforceAttendanceController,

    WorkforceAttendanceIngestController,

  ],

  providers: [

    WorkforceEntitlementService,

    WorkforceAuditService,

    WorkforceScopeService,

    WorkforceOrgUnitsService,

    WorkforcePositionsService,

    WorkforceOrgScopeService,

    WorkforceEmploymentsService,

    WorkforceAbsencesService,

    WorkforceRoleTemplateService,

    WorkforceSeatService,

    WorkforceProvisionService,

    WorkforceManualGrantService,

    WorkforceSecurityService,

    WorkforceExportService,

    WorkforceImportService,

    WorkforceMigrationService,

    WorkforceTimesheetsService,

    WorkforceRosterCache,

    WorkforceRosterService,

    WorkforceHoldingService,

    WorkforceTimesheetSubscriberService,

    WorkforceVacationPlansService,

    WorkforcePersonnelOrdersService,

    FinanceWorkforceMirrorClient,

    StaffScheduleRevisionsService,

    WorkforceAttendanceService,

    WorkforceAttendanceCronService,

  ],

  exports: [

    WorkforceEmploymentsService,

    WorkforceAbsencesService,

    WorkforceOrgUnitsService,

    WorkforceScopeService,

    WorkforceProvisionService,

    WorkforceRoleTemplateService,

    WorkforceSeatService,

    WorkforceAttendanceService,

  ],

})

export class WorkforceHubModule {}

