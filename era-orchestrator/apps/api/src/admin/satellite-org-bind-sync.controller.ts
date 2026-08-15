import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { SatelliteOrgBindSyncService } from "./satellite-org-bind-sync.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin/orgs/:orgId")
export class SatelliteOrgBindSyncController {
  constructor(private readonly sync: SatelliteOrgBindSyncService) {}

  @Post("sync-satellite-bindings")
  syncBindings(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.sync.syncForOrg(orgId);
  }
}
