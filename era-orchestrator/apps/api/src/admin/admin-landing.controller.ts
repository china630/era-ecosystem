import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { PatchLandingModuleMarketingDto } from "./dto/patch-landing-module-marketing.dto";
import { LandingMarketingService } from "./landing-marketing.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin")
export class AdminLandingController {
  constructor(private readonly landing: LandingMarketingService) {}

  @Get("landing-modules")
  listLandingModules() {
    return this.landing.listLandingModulesAdmin();
  }

  @Patch("landing-modules/:moduleSlug")
  patchLandingModule(
    @Param("moduleSlug") moduleSlug: string,
    @Body() dto: PatchLandingModuleMarketingDto,
  ) {
    return this.landing.patchLandingModuleMarketing(moduleSlug, dto);
  }
}
