import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { SetOperatingModeDto } from "./dto/set-operating-mode.dto";
import { OrgOperatingModeService } from "./org-operating-mode.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin/orgs/:orgId/operating-mode")
export class OrgOperatingModeController {
  constructor(private readonly service: OrgOperatingModeService) {}

  @Get()
  get(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.get(orgId);
  }

  @Put()
  set(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: SetOperatingModeDto,
  ) {
    return this.service.set(orgId, body);
  }

  @Post("detach")
  detach(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.detach(orgId);
  }
}
