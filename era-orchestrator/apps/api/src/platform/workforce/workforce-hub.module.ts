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

import { WorkforceTimesheetsController } from "./workforce-timesheets.controller";

import { WorkforceTimesheetsService } from "./workforce-timesheets.service";

import { WorkforceTimesheetSubscriberService } from "./workforce-timesheet-subscriber.service";

import { LicensingSeatsController } from "./licensing-seats.controller";

import { WorkforceSeatsController } from "./workforce-seats.controller";



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

    WorkforceTimesheetsController,

    LicensingSeatsController,

    WorkforceSeatsController,

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

    WorkforceTimesheetsService,

    WorkforceTimesheetSubscriberService,

  ],

  exports: [

    WorkforceEmploymentsService,

    WorkforceAbsencesService,

    WorkforceOrgUnitsService,

    WorkforceScopeService,

    WorkforceProvisionService,

    WorkforceRoleTemplateService,

    WorkforceSeatService,

  ],

})

export class WorkforceHubModule {}

