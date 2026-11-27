import { CP_PERMISSION } from "../auth/cp-permissions";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { SiteCatalogService } from "./site-catalog.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/site-catalog")
export class AdminSiteCatalogController {
  constructor(private readonly catalog: SiteCatalogService) {}

  @Get("satellites")
  listSatellites() {
    return this.catalog.listAdminSatellites();
  }

  @Patch("satellites/:satelliteKey")
  patchSatellite(
    @Param("satelliteKey") satelliteKey: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.catalog.patchSatelliteProfile(satelliteKey, body as never);
  }

  @Get("modules")
  listModules() {
    return this.catalog.listAdminModules();
  }

  @Patch("modules/:moduleKey")
  patchModule(
    @Param("moduleKey") moduleKey: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.catalog.patchModuleProfile(moduleKey, body as never);
  }

  @Get("industries")
  listIndustries() {
    return this.catalog.listAdminIndustries();
  }

  @Get("commercial-keys")
  commercialKeys() {
    return this.catalog.listCommercialKeys();
  }

  @Post("industries")
  createIndustry(@Body() body: Record<string, unknown>) {
    return this.catalog.createIndustry(body as never);
  }

  @Patch("industries/:slug")
  patchIndustry(
    @Param("slug") slug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.catalog.patchIndustry(slug, body as never);
  }

  @Get("edges")
  listEdges() {
    return this.catalog.listAdminEdges();
  }

  @Patch("edges/:id")
  patchEdge(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.catalog.patchEdge(id, body as never);
  }
}
