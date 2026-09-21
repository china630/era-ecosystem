import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
  AttendanceCsvImportDto,
  AttendanceRebuildDto,
  CreateAttendanceDeviceDto,
  UpsertAttendanceIdentityDto,
} from "./dto/workforce-attendance.dto";
import { WorkforceAttendanceService } from "./workforce-attendance.service";

@ApiTags("platform-workforce-attendance")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/attendance")
@UseGuards(PermissionsGuard)
export class WorkforceAttendanceController {
  constructor(private readonly attendance: WorkforceAttendanceService) {}

  @Get("devices")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  @ApiOperation({ summary: "List attendance devices for org" })
  listDevices(@OrganizationId() organizationId: string) {
    return this.attendance.listDevices(organizationId);
  }

  @Post("devices")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  @ApiOperation({
    summary: "Create device; returns token once (att_…). Optional requireHmac.",
  })
  createDevice(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateAttendanceDeviceDto,
  ) {
    return this.attendance.createDevice(organizationId, user.sub, dto);
  }

  @Post("devices/:id/revoke")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  revokeDevice(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.attendance.revokeDevice(organizationId, id, user.sub);
  }

  @Get("identities")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  listIdentities(@OrganizationId() organizationId: string) {
    return this.attendance.listIdentities(organizationId);
  }

  @Post("identities")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  upsertIdentity(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpsertAttendanceIdentityDto,
  ) {
    return this.attendance.upsertIdentity(organizationId, user.sub, dto);
  }

  @Get("punches")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  listPunches(
    @OrganizationId() organizationId: string,
    @Query("status") status?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.attendance.listPunches(organizationId, {
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post("rebuild")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  @ApiOperation({
    summary:
      "Pair IN/OUT punches and upsert DRAFT timesheet cells (source=faceid). Skips APPROVED / absence lock. Body or ?from=&to=.",
  })
  rebuild(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: AttendanceRebuildDto,
    @Query("from") fromQ?: string,
    @Query("to") toQ?: string,
    @Query("usePlannedIfOpen") usePlannedQ?: string,
  ) {
    const from = dto.from ?? fromQ;
    const to = dto.to ?? toQ;
    if (!from || !to) {
      throw new BadRequestException("from and to required (body or query)");
    }
    const usePlannedIfOpen =
      dto.usePlannedIfOpen === true ||
      usePlannedQ === "true" ||
      usePlannedQ === "1";
    return this.attendance.rebuild(organizationId, user.sub, from, to, {
      usePlannedIfOpen,
    });
  }

  @Post("import-csv")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ATTENDANCE)
  @ApiOperation({
    summary:
      "CSV/xlsx fallback into the same punch pipeline (occurredAt,direction,personRef[,externalId,placeCode]).",
  })
  importCsv(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: AttendanceCsvImportDto,
  ) {
    return this.attendance.importCsv(
      organizationId,
      user.sub,
      dto.deviceId,
      dto.csv,
      dto.xlsxBase64,
    );
  }
}
