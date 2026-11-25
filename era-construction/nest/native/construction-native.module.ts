import { Module } from "@nestjs/common";
import { HealthController } from "./controllers/health.controller";
import { LocaleController } from "./controllers/locale.controller";
import { AuthController } from "./controllers/auth.controller";
import { AdminController } from "./controllers/admin.controller";
import { AuditExemptController } from "./controllers/audit-exempt.controller";
import { ProjectsController } from "./controllers/projects.controller";
import { EstimateController } from "./controllers/estimate.controller";
import { RateEngineController } from "./controllers/rate-engine.controller";
import { BoqController } from "./controllers/boq.controller";
import { ActsController } from "./controllers/acts.controller";
import { PlanVsActualController } from "./controllers/plan-vs-actual.controller";
import { ProgressActsController } from "./controllers/progress-acts.controller";
import { DailyLogsController } from "./controllers/daily-logs.controller";
import { PunchListController } from "./controllers/punch-list.controller";
import { MaterialsController } from "./controllers/materials.controller";
import { CdeController } from "./controllers/cde.controller";
import { GanttController } from "./controllers/gantt.controller";
import { ClaimsController } from "./controllers/claims.controller";
import { EquipmentController } from "./controllers/equipment.controller";
import { TimesheetsController } from "./controllers/timesheets.controller";
import { CalendarController } from "./controllers/calendar.controller";
import { VoenController } from "./controllers/voen.controller";
import { ScaffoldController } from "./controllers/scaffold.controller";
import { PlatformController } from "./controllers/platform.controller";
import { EventsController } from "./controllers/events.controller";
import { InternalController } from "./controllers/internal.controller";
import { IntegrationController } from "./controllers/integration.controller";
import { ConstructionStaffGuard } from "./guards/staff.guard";

/** Native Nest Controllers over @/lib services (Construction Nest cutover). */
@Module({
  controllers: [
    HealthController,
    LocaleController,
    AuthController,
    AdminController,
    AuditExemptController,
    ProjectsController,
    EstimateController,
    RateEngineController,
    BoqController,
    ActsController,
    PlanVsActualController,
    ProgressActsController,
    DailyLogsController,
    PunchListController,
    MaterialsController,
    CdeController,
    GanttController,
    ClaimsController,
    EquipmentController,
    TimesheetsController,
    CalendarController,
    VoenController,
    ScaffoldController,
    PlatformController,
    EventsController,
    InternalController,
    IntegrationController,
  ],
  providers: [ConstructionStaffGuard],
})
export class ConstructionNativeModule {}
