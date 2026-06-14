import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { CreateDepartmentOrgDto } from "./dto/create-department-org.dto";
import { OrgDepartmentsService } from "./org-departments.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin/orgs/:orgId/departments")
export class OrgDepartmentsController {
  constructor(private readonly departments: OrgDepartmentsService) {}

  @Get()
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.departments.listForParent(orgId);
  }

  @Post()
  create(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: CreateDepartmentOrgDto,
  ) {
    return this.departments.createUnderParent(orgId, body);
  }
}
