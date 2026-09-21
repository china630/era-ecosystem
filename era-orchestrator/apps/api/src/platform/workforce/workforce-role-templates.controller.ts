import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  UpsertRoleTemplateDto,
  ListRoleTemplatesQueryDto,
} from "./dto/workforce-role-template.dto";
import { WorkforceRoleTemplateService } from "./workforce-role-template.service";

@ApiTags("platform-workforce-role-templates")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/role-templates")
@UseGuards(PermissionsGuard)
export class WorkforceRoleTemplatesController {
  constructor(private readonly templates: WorkforceRoleTemplateService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROLE_TEMPLATES)
  @ApiOperation({ summary: "List satellite role templates" })
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListRoleTemplatesQueryDto,
  ) {
    return this.templates.list(organizationId, query.positionId);
  }

  @Put()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROLE_TEMPLATES)
  @ApiOperation({ summary: "Upsert role template row" })
  upsert(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpsertRoleTemplateDto,
  ) {
    return this.templates.upsert(organizationId, user.sub, dto);
  }

  @Delete(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROLE_TEMPLATES)
  @ApiOperation({ summary: "Remove role template" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.templates.remove(organizationId, id, user.sub);
  }
}
