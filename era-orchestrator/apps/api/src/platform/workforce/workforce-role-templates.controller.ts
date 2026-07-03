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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  UpsertRoleTemplateDto,
  ListRoleTemplatesQueryDto,
} from "./dto/workforce-role-template.dto";
import { WorkforceRoleTemplateService } from "./workforce-role-template.service";

@ApiTags("platform-workforce-role-templates")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/role-templates")
@UseGuards(RolesGuard)
export class WorkforceRoleTemplatesController {
  constructor(private readonly templates: WorkforceRoleTemplateService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "List satellite role templates" })
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListRoleTemplatesQueryDto,
  ) {
    return this.templates.list(organizationId, query.positionId);
  }

  @Put()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Upsert role template row" })
  upsert(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpsertRoleTemplateDto,
  ) {
    return this.templates.upsert(organizationId, user.sub, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Remove role template" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.templates.remove(organizationId, id, user.sub);
  }
}
