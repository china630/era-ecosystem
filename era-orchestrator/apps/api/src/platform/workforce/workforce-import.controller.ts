import {
  Body,
  Controller,
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
import { ImportCsvDto } from "./dto/workforce-import.dto";
import { WorkforceImportService } from "./workforce-import.service";
import { csvFromWorkforceImportBody } from "./workforce-xlsx";

@ApiTags("platform-workforce-import")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/import")
@UseGuards(PermissionsGuard)
export class WorkforceImportController {
  constructor(private readonly importService: WorkforceImportService) {}

  @Post("roster")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({
    summary:
      "Import roster from CSV/xlsx (dryRun supported). New hires need fin+fullName; empty satellites = headcount (no seat); ADDITIONAL workplace = second job without a seat.",
  })
  async roster(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("dryRun") dryRun: string | undefined,
    @Body() body: ImportCsvDto,
  ) {
    return this.importService.importRoster(
      organizationId,
      user.sub,
      csvFromWorkforceImportBody(body),
      dryRun === "true" || dryRun === "1",
    );
  }

  @Post("absences")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({ summary: "Import absences from CSV (dryRun supported)" })
  async absences(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("dryRun") dryRun: string | undefined,
    @Body() body: ImportCsvDto,
  ) {
    return this.importService.importAbsences(
      organizationId,
      user.sub,
      csvFromWorkforceImportBody(body),
      dryRun === "true" || dryRun === "1",
    );
  }

  @Post("org-structure")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({
    summary:
      "Import org units + positions from CSV/xlsx (dryRun supported). Idempotent upsert by name; does not delete extra rows.",
  })
  async orgStructure(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("dryRun") dryRun: string | undefined,
    @Body() body: ImportCsvDto,
  ) {
    return this.importService.importOrgStructure(
      organizationId,
      user.sub,
      csvFromWorkforceImportBody(body),
      dryRun === "true" || dryRun === "1",
    );
  }
}
