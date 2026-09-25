import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole, WorkforcePlaceStatus } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreateWorkforceBrigadeDto,
  CreateWorkforceDayOverrideDto,
  CreateWorkforcePlaceDto,
  CreateWorkforceShiftAssignmentDto,
  CreateWorkforceShiftCycleDto,
  CreateWorkforceShiftTypeDto,
  LeaveWorkforceBrigadeMembersDto,
  ListBrigadeMembershipsQueryDto,
  TransferWorkforceBrigadeMembersDto,
  UpdateWorkforceBrigadeDto,
  UpdateWorkforcePlaceDto,
  UpdateWorkforceShiftAssignmentDto,
  UpdateWorkforceShiftCycleDto,
  UpdateWorkforceShiftTypeDto,
} from "./dto/workforce-roster.dto";
import { WorkforceRosterService } from "./workforce-roster.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";

@ApiTags("platform-workforce-roster")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce")
@UseGuards(PermissionsGuard)
export class WorkforceRosterController {
  constructor(
    private readonly roster: WorkforceRosterService,
    private readonly employments: WorkforceEmploymentsService,
  ) {}

  // Places
  @Get("places")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List workforce places (sites/posts)" })
  listPlaces(
    @OrganizationId() organizationId: string,
    @Query("status") statusRaw?: string,
  ) {
    const status =
      statusRaw === "ACTIVE" || statusRaw === "ARCHIVED"
        ? (statusRaw as WorkforcePlaceStatus)
        : undefined;
    return this.roster.listPlaces(organizationId, status);
  }

  @Post("places")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  createPlace(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforcePlaceDto,
  ) {
    return this.roster.createPlace(organizationId, user.sub, dto);
  }

  @Patch("places/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  updatePlace(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforcePlaceDto,
  ) {
    return this.roster.updatePlace(organizationId, id, user.sub, dto);
  }

  @Post("places/:id/archive")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  archivePlace(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.roster.archivePlace(organizationId, id, user.sub);
  }

  // Shift types
  @Get("shift-types")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listShiftTypes(@OrganizationId() organizationId: string) {
    return this.roster.listShiftTypes(organizationId);
  }

  @Post("shift-types")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  createShiftType(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceShiftTypeDto,
  ) {
    return this.roster.createShiftType(organizationId, user.sub, dto);
  }

  @Patch("shift-types/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  updateShiftType(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceShiftTypeDto,
  ) {
    return this.roster.updateShiftType(organizationId, id, user.sub, dto);
  }

  // Cycles
  @Get("shift-cycles")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listCycles(@OrganizationId() organizationId: string) {
    return this.roster.listCycles(organizationId);
  }

  @Post("shift-cycles")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  createCycle(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceShiftCycleDto,
  ) {
    return this.roster.createCycle(organizationId, user.sub, dto);
  }

  @Patch("shift-cycles/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  updateCycle(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceShiftCycleDto,
  ) {
    return this.roster.updateCycle(organizationId, id, user.sub, dto);
  }

  @Post("roster/ensure-defaults")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  @ApiOperation({ summary: "Seed default shift types (E/N/OFFICE/H24) and 5/2, 2/2, 24/48 cycles" })
  ensureDefaults(@OrganizationId() organizationId: string) {
    return this.roster.ensureDefaults(organizationId);
  }

  @Get("roster/preview")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({
    summary:
      "Person × day labor plan preview (read-only; place/orgUnit filters). Does not write timesheet.",
  })
  async preview(
    @OrganizationId() organizationId: string,
    @Query("year") yearRaw?: string,
    @Query("month") monthRaw?: string,
    @Query("placeId") placeId?: string,
    @Query("orgUnitId") orgUnitId?: string,
  ) {
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const body = await this.roster.previewMonth(organizationId, year, month, {
      placeId: placeId?.trim() || undefined,
      orgUnitId: orgUnitId?.trim() || undefined,
    });
    const personIds = [
      ...new Set(body.rows.map((r) => r.globalPersonId).filter(Boolean)),
    ];
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      personIds,
    );
    return { ...body, persons };
  }

  // Brigades — static paths before :id
  @Post("brigades/transfers")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  @ApiOperation({ summary: "Transfer or join employments into a brigade as of a Baku day" })
  transferBrigadeMembers(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: TransferWorkforceBrigadeMembersDto,
  ) {
    return this.roster.transferBrigadeMembers(organizationId, user.sub, dto);
  }

  @Post("brigades/leaves")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  @ApiOperation({ summary: "Close open brigade membership as of a Baku day (no target crew)" })
  leaveBrigadeMembers(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: LeaveWorkforceBrigadeMembersDto,
  ) {
    return this.roster.leaveBrigadeMembers(organizationId, user.sub, dto);
  }

  @Get("brigade-memberships")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Dated brigade membership history" })
  listBrigadeMemberships(
    @OrganizationId() organizationId: string,
    @Query() query: ListBrigadeMembershipsQueryDto,
  ) {
    return this.roster.listBrigadeMemberships(organizationId, query);
  }

  @Get("brigades")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listBrigades(
    @OrganizationId() organizationId: string,
    @Query("asOf") asOf?: string,
  ) {
    return this.roster.listBrigades(organizationId, asOf);
  }

  @Get("brigades/:id/members")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listBrigadeMembers(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Query("asOf") asOf?: string,
  ) {
    return this.roster.listBrigadeMembers(organizationId, id, asOf);
  }

  @Post("brigades")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  createBrigade(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceBrigadeDto,
  ) {
    return this.roster.createBrigade(organizationId, user.sub, dto);
  }

  @Patch("brigades/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  updateBrigade(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceBrigadeDto,
  ) {
    return this.roster.updateBrigade(organizationId, id, user.sub, dto);
  }

  // Assignments
  @Get("shift-assignments")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listAssignments(@OrganizationId() organizationId: string) {
    return this.roster.listAssignments(organizationId);
  }

  @Post("shift-assignments")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  createAssignment(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceShiftAssignmentDto,
  ) {
    return this.roster.createAssignment(organizationId, user.sub, dto);
  }

  @Patch("shift-assignments/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  updateAssignment(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforceShiftAssignmentDto,
  ) {
    return this.roster.updateAssignment(organizationId, id, user.sub, dto);
  }

  // Day overrides
  @Get("day-overrides")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listOverrides(
    @OrganizationId() organizationId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.roster.listOverrides(organizationId, from, to);
  }

  @Put("day-overrides")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  upsertOverride(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforceDayOverrideDto,
  ) {
    return this.roster.upsertOverride(organizationId, user.sub, dto);
  }

  @Delete("day-overrides/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROSTER)
  deleteOverride(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.roster.deleteOverride(organizationId, id, user.sub);
  }
}
