import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { AdminOrganizationsService } from "./admin-organizations.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin/organizations")
export class AdminOrganizationsController {
  constructor(private readonly orgs: AdminOrganizationsService) {}

  @Get()
  list(
    @Query("q") q?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize?: number,
  ) {
    return this.orgs.list({ q, page, pageSize });
  }
}
