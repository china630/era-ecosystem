import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { UpsertClinicCutoverDto } from "./dto/upsert-clinic-cutover.dto";
import { UpsertElektrawebBridgeDto } from "./dto/upsert-elektraweb-bridge.dto";
import { ElektrawebBridgePolicyService } from "./elektraweb-bridge-policy.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin/orgs/:orgId")
export class ElektrawebBridgePolicyController {
  constructor(private readonly service: ElektrawebBridgePolicyService) {}

  /** Combined view: hotel bridge and/or clinic cutover keyed by industries. */
  @Get("elektraweb-bridge")
  getBridge(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.getBundle(orgId);
  }

  @Put("elektraweb-bridge")
  putBridge(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: UpsertElektrawebBridgeDto,
  ) {
    return this.service.upsertBridge(orgId, body);
  }

  @Get("clinic-cutover")
  getClinicCutover(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.getClinicCutover(orgId);
  }

  @Put("clinic-cutover")
  putClinicCutover(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: UpsertClinicCutoverDto,
  ) {
    return this.service.upsertClinicCutover(orgId, body);
  }
}
