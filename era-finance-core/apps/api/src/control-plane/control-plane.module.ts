import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ControlPlaneClient } from "./control-plane.client";
import { ControlPlaneEntitlementGuard } from "./control-plane-entitlement.guard";
import { ControlPlanePrismaService } from "./control-plane-prisma.service";
import { OrganizationBindController } from "./organization-bind.controller";
import { RuntimeConfigController } from "./runtime-config.controller";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RuntimeConfigController, OrganizationBindController],
  providers: [
    ControlPlaneClient,
    ControlPlaneEntitlementGuard,
    ControlPlanePrismaService,
  ],
  exports: [
    ControlPlaneClient,
    ControlPlaneEntitlementGuard,
    ControlPlanePrismaService,
  ],
})
export class ControlPlaneModule {}
