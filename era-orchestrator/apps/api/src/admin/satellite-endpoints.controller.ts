import {
  Body,
  Controller,
  Delete,
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
import { SatelliteEndpointRegistryService } from "../satellite-events/satellite-endpoint-registry.service";
import { UpsertSatelliteEndpointDto } from "./dto/upsert-satellite-endpoint.dto";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin/orgs/:orgId/satellite-endpoints")
export class SatelliteEndpointsController {
  constructor(private readonly registry: SatelliteEndpointRegistryService) {}

  @Get()
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.registry.listForOrg(orgId);
  }

  @Put(":satelliteKey")
  upsert(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("satelliteKey") satelliteKey: string,
    @Body() body: UpsertSatelliteEndpointDto,
  ) {
    return this.registry.upsertEndpoint({
      organizationId: orgId,
      satelliteKey: body.satelliteKey || satelliteKey,
      baseUrl: body.baseUrl,
      secret: body.secret,
      enabled: body.enabled,
    });
  }

  @Delete(":satelliteKey")
  async remove(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("satelliteKey") satelliteKey: string,
  ) {
    await this.registry.removeEndpoint(orgId, satelliteKey);
    return { ok: true };
  }
}
