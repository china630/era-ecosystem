import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { OrganizationId } from "../../common/org-id.decorator";
import { WorkforceExportService } from "./workforce-export.service";

@ApiTags("platform-workforce-export")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/export")
@UseGuards(PermissionsGuard)
export class WorkforceExportController {
  constructor(private readonly exportService: WorkforceExportService) {}

  @Get("roster")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_EXPORT)
  @ApiOperation({ summary: "Export active roster CSV (no FIN)" })
  async roster(
    @OrganizationId() organizationId: string,
    @Query("format") format: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportRosterCsv(organizationId);
    if (format === "json") {
      return res.json({ format: "csv", content: csv });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="workforce-roster.csv"',
    );
    return res.send(csv);
  }

  @Get("absences")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_EXPORT)
  @ApiOperation({ summary: "Export approved absences CSV for period" })
  async absences(
    @OrganizationId() organizationId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Res() res: Response,
  ) {
    const fromIso = from ?? new Date().toISOString().slice(0, 10);
    const toIso =
      to ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const csv = await this.exportService.exportAbsencesCsv(
      organizationId,
      fromIso,
      toIso,
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="workforce-absences.csv"',
    );
    return res.send(csv);
  }

  @Get("timesheet")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_EXPORT)
  @ApiOperation({ summary: "Export approved CP timesheet rows CSV" })
  async timesheet(
    @OrganizationId() organizationId: string,
    @Query("year") year: string,
    @Query("month") month: string,
    @Res() res: Response,
  ) {
    const y = Number(year) || new Date().getUTCFullYear();
    const m = Number(month) || new Date().getUTCMonth() + 1;
    const csv = await this.exportService.exportTimesheetCsv(organizationId, y, m);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="workforce-timesheet-${y}-${String(m).padStart(2, "0")}.csv"`,
    );
    return res.send(csv);
  }
}
