import { CP_PERMISSION } from "../auth/cp-permissions";
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { UpsertClinicCutoverDto } from "./dto/upsert-clinic-cutover.dto";
import { UpsertElektrawebBridgeDto } from "./dto/upsert-elektraweb-bridge.dto";
import { ElektrawebBridgePolicyService } from "./elektraweb-bridge-policy.service";
import { SatelliteOrgBindSyncService } from "./satellite-org-bind-sync.service";

export type PolicyDeliveryItem = {
  satelliteKey: string;
  ok: boolean;
  error?: string;
};

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/orgs/:orgId")
export class ElektrawebBridgePolicyController {
  private readonly logger = new Logger(ElektrawebBridgePolicyController.name);

  constructor(
    private readonly service: ElektrawebBridgePolicyService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Combined view: hotel bridge and/or clinic cutover keyed by industries. */
  @Get("elektraweb-bridge")
  getBridge(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.getBundle(orgId);
  }

  /** Saves the policy, then pushes runtime-config so satellites apply it now. */
  @Put("elektraweb-bridge")
  async putBridge(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: UpsertElektrawebBridgeDto,
  ) {
    const saved = await this.service.upsertBridge(orgId, body);
    return { ...saved, delivery: await this.deliver(orgId) };
  }

  @Get("clinic-cutover")
  getClinicCutover(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.getClinicCutover(orgId);
  }

  @Put("clinic-cutover")
  async putClinicCutover(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: UpsertClinicCutoverDto,
  ) {
    const saved = await this.service.upsertClinicCutover(orgId, body);
    return { ...saved, delivery: await this.deliver(orgId) };
  }

  /**
   * SatelliteOrgBindSyncService lives in SatelliteEventsModule, which already
   * depends on AdminModule — resolve lazily instead of importing the module.
   * A failed push never undoes the save; the UI shows which satellites missed it.
   */
  private async deliver(orgId: string): Promise<PolicyDeliveryItem[]> {
    try {
      const sync = this.moduleRef.get(SatelliteOrgBindSyncService, { strict: false });
      const { results } = await sync.syncForOrg(orgId);
      return results.map((r) => ({
        satelliteKey: r.satelliteKey,
        ok: r.ok,
        ...(r.ok ? {} : { error: r.error ?? "sync failed" }),
      }));
    } catch (err) {
      const error = err instanceof Error ? err.message : "sync failed";
      this.logger.warn(`Policy push for ${orgId} failed: ${error}`);
      return [{ satelliteKey: "*", ok: false, error }];
    }
  }
}
