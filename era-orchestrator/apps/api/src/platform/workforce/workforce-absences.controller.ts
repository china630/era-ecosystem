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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
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
@UseGuards(RolesGuard)
export class WorkforceAbsencesController {
  constructor(
    private readonly absences: WorkforceAbsencesService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly orgScope: WorkforceOrgScopeService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Create absence (DRAFT or SUBMITTED)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceAbsenceDto,
  ) {
    return this.absences.create(organizationId, user.sub, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "DRAFT → SUBMITTED" })
  submit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.absences.submit(organizationId, id, user.sub);
  }

  @Post(":id/approve")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "SUBMITTED → APPROVED (+ Finance mirror event)" })
  approve(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.absences.approve(organizationId, id, user.sub);
  }

  @Post(":id/reject")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "APPROVED → CANCELLED (+ Finance mirror event)" })
  cancel(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.absences.cancel(organizationId, id, user.sub);
  }
}
