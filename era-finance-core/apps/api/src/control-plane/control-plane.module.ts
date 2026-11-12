import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ControlPlaneClient } from "./control-plane.client";
import { ControlPlaneEntitlementGuard } from "./control-plane-entitlement.guard";
import { ControlPlanePrismaService } from "./control-plane-prisma.service";
import { ControlPlaneOrganizationService } from "./control-plane-organization.service";
import { OrganizationBindController } from "./organization-bind.controller";
import { RuntimeConfigController } from "./runtime-config.controller";
import { OrgAccessClient } from "./org-access.client";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RuntimeConfigController, OrganizationBindController],
  providers: [
    ControlPlaneClient,
    ControlPlaneEntitlementGuard,
    ControlPlanePrismaService,
    ControlPlaneOrganizationService,
    OrgAccessClient,
  ],
  exports: [
    ControlPlaneClient,
    ControlPlaneEntitlementGuard,
    ControlPlanePrismaService,
    ControlPlaneOrganizationService,
    OrgAccessClient,
  ],
})
export class ControlPlaneModule {}
