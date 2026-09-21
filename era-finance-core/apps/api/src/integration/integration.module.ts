import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { HrModule } from "../hr/hr.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PiiCryptoService } from "../security/pii-crypto.service";
import { SubscriptionModule } from "../subscription/subscription.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { InventoryModule } from "../inventory/inventory.module";
import { SatelliteEventDispatchService } from "./satellite-event-dispatch.service";
import { SatelliteEventIdempotencyService } from "./satellite-event-idempotency.service";
import { SatelliteEventWorker } from "./satellite-event.worker";
import { WorkforceAbsenceSyncService } from "./workforce-absence-sync.service";
import { WorkforceEmploymentSyncService } from "./workforce-employment-sync.service";
import { WorkforceOrgEnsureService } from "./workforce-org-ensure.service";
import { WorkforceOrgSyncService } from "./workforce-org-sync.service";
import { WorkforceTimesheetSyncService } from "./workforce-timesheet-sync.service";
import { FinanceAccountingAdapterService } from "./accounting-adapter.service";

@Module({
  imports: [
    PrismaModule,
    AccountingModule,
    InvoicesModule,
    HrModule,
    OrganizationsModule,
    OrchestratorModule,
    SubscriptionModule,
    CounterpartiesModule,
    InventoryModule,
  ],
  providers: [
    PiiCryptoService,
    WorkforceOrgEnsureService,
    SatelliteEventIdempotencyService,
    SatelliteEventDispatchService,
    FinanceAccountingAdapterService,
    SatelliteEventWorker,
    WorkforceAbsenceSyncService,
    WorkforceOrgSyncService,
    WorkforceEmploymentSyncService,
    WorkforceTimesheetSyncService,
  ],
  exports: [FinanceAccountingAdapterService, SatelliteEventDispatchService],
})
export class SatelliteIntegrationModule {}
