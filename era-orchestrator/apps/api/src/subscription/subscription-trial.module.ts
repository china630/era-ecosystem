import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { DepartmentProvisionService } from "./department-provision.service";
import { SatelliteConnectService } from "./satellite-connect.service";
import { TrialCatalogService } from "./trial-catalog.service";
import { TrialEntitlementResolver } from "./trial-entitlement.resolver";
import { TrialProvisionService } from "./trial-provision.service";
import { TrialSyncService } from "./trial-sync.service";

/** Trial hierarchy services — no AdminModule import (avoids circular DI). */
@Global()
@Module({
  imports: [PrismaModule, SystemConfigModule],
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
