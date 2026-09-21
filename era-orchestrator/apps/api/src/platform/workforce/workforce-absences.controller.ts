import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  CreateWorkforceAbsenceDto,
  ListWorkforceAbsencesQueryDto,
  RejectWorkforceAbsenceDto,
  UpdateWorkforceAbsenceDto,
} from "./dto/workforce-absence.dto";
import { WorkforceAbsencesService } from "./workforce-absences.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceOrgScopeService } from "./workforce-org-scope.service";

@ApiTags("platform-workforce-absences")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/absences")
@UseGuards(PermissionsGuard)
export class WorkforceAbsencesController {
  constructor(
    private readonly absences: WorkforceAbsencesService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly orgScope: WorkforceOrgScopeService,
  ) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List workforce absences" })
  async list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query() query: ListWorkforceAbsencesQueryDto,
  ) {
    const managedIds = await this.orgScope.resolveManagedOrgUnitIds(
      organizationId,
      user.sub,
      user.role ?? undefined,
    );
    const rows = await this.absences.list(organizationId, query, managedIds);
    const personIds = rows.map((r) => r.employment.globalPersonId);
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      personIds,
    );
    return { items: rows, persons };
  }

  @Get(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Workforce absence detail" })
  async getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.absences.getOne(organizationId, id);
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      [row.employment.globalPersonId],
    );
    return {
      ...row,
      person: persons[row.employment.globalPersonId] ?? null,
    };
  }

  @Post()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "Create absence (DRAFT or SUBMITTED)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceAbsenceDto,
  ) {
    return this.absences.create(organizationId, user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "Update absence dates/note/kind" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceAbsenceDto,
  ) {
    return this.absences.update(organizationId, id, user.sub, dto);
  }

  @Post(":id/submit")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "DRAFT → SUBMITTED" })
  submit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.absences.submit(organizationId, id, user.sub);
  }

  @Post(":id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "SUBMITTED → APPROVED (+ Finance mirror event)" })
  approve(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.absences.approve(organizationId, id, user.sub);
  }

  @Post(":id/reject")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "SUBMITTED → REJECTED" })
  reject(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: RejectWorkforceAbsenceDto,
  ) {
    return this.absences.reject(organizationId, id, user.sub, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "APPROVED → CANCELLED (+ Finance mirror event)" })
  cancel(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.absences.cancel(organizationId, id, user.sub);
  }
}
