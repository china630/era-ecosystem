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
  CancelWorkforceAbsenceDto,
  CreateWorkforceAbsenceDto,
  ListWorkforceAbsencesQueryDto,
  RejectWorkforceAbsenceDto,
  UpdateWorkforceAbsenceDto,
} from "./dto/workforce-absence.dto";
import { WorkforceAbsencesService } from "./workforce-absences.service";
import { WorkforceApprovalService } from "./workforce-approval.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceOrgScopeService } from "./workforce-org-scope.service";
import { RequireWorkforceFeature, WorkforcePackageGuard } from "./workforce-package.guard";

@ApiTags("platform-workforce-absences")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/absences")
@RequireWorkforceFeature("absence")
@UseGuards(PermissionsGuard, WorkforcePackageGuard)
export class WorkforceAbsencesController {
  constructor(
    private readonly absences: WorkforceAbsencesService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly orgScope: WorkforceOrgScopeService,
    private readonly approval: WorkforceApprovalService,
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
    const approval: Record<string, Awaited<ReturnType<WorkforceApprovalService["labelFor"]>>> = {};
    for (const row of rows) {
      approval[row.id] = await this.approval.labelFor(
        organizationId,
        this.approval.kindForAbsence(row.kind),
        row.employmentId,
        row.currentStepOrder ?? 0,
      );
    }
    return { items: rows, persons, approval };
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
    const approval = await this.approval.labelFor(
      organizationId,
      this.approval.kindForAbsence(row.kind),
      row.employmentId,
      row.currentStepOrder ?? 0,
    );
    return {
      ...row,
      person: persons[row.employment.globalPersonId] ?? null,
      approval,
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
    @Body() dto: CancelWorkforceAbsenceDto,
  ) {
    return this.absences.cancel(organizationId, id, user.sub, dto.reason);
  }

  @Post(":id/correct")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "APPROVED → new SUBMITTED correction; original stays until the correction is approved" })
  correct(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceAbsenceDto,
  ) {
    return this.absences.correct(organizationId, id, user.sub, dto);
  }
}
