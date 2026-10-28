import { Global, Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SatelliteEventsModule } from "../satellite-events/satellite-events.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { DepartmentProvisionService } from "./department-provision.service";
import { SatelliteConnectService } from "./satellite-connect.service";
import { TrialCatalogService } from "./trial-catalog.service";
import { TrialEntitlementResolver } from "./trial-entitlement.resolver";
import { TrialProvisionService } from "./trial-provision.service";
import { TrialSyncService } from "./trial-sync.service";

/** Trial hierarchy services — SatelliteEvents for Sync after connect (avoids AdminModule cycle). */
@Global()
@Module({
  imports: [PrismaModule, SystemConfigModule, forwardRef(() => SatelliteEventsModule)],
  providers: [
    TrialProvisionService,
    TrialCatalogService,
    TrialEntitlementResolver,
    SatelliteConnectService,
    TrialSyncService,
    DepartmentProvisionService,
  ],
  exports: [
    TrialProvisionService,
    TrialCatalogService,
    TrialEntitlementResolver,
    SatelliteConnectService,
    TrialSyncService,
    DepartmentProvisionService,
  ],
})
export class SubscriptionTrialModule {}
