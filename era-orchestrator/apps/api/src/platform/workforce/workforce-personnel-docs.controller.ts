import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Body,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreatePersonnelOrderDto,
  CreateStaffScheduleRevisionDto,
  ListPersonnelOrdersQueryDto,
  PreviewPersonnelOrderTemplateDto,
  UpsertPersonnelOrderTemplateDto,
} from "./dto/workforce-personnel-docs.dto";
import { WorkforcePersonnelOrdersService } from "./workforce-personnel-orders.service";
import { StaffScheduleRevisionsService } from "./staff-schedule-revisions.service";

class PatchPersonnelOrderSettingsDto {
  @IsOptional()
  @IsBoolean()
  requireOrderIssuedBeforeTerminate?: boolean;
}

@ApiTags("platform-workforce-personnel-orders")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/personnel-orders")
@UseGuards(PermissionsGuard)
export class WorkforcePersonnelOrdersController {
  constructor(private readonly orders: WorkforcePersonnelOrdersService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "List personnel orders (hire/transfer/terminate/leave)" })
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListPersonnelOrdersQueryDto,
  ) {
    return this.orders.list(organizationId, query);
  }

  @Get("templates")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "List org/holding/builtin order templates" })
  listTemplates(@OrganizationId() organizationId: string) {
    return this.orders.listTemplates(organizationId);
  }

  @Put("templates")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "Upsert org or holding HTML order template" })
  upsertTemplate(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpsertPersonnelOrderTemplateDto,
  ) {
    return this.orders.upsertTemplate(organizationId, user.sub, dto);
  }

  @Post("templates/preview-pdf")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({
    summary: "Preview personnel order template as PDF (no order created)",
  })
  async previewTemplatePdf(
    @OrganizationId() organizationId: string,
    @Body() dto: PreviewPersonnelOrderTemplateDto,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.orders.previewTemplatePdf(
      organizationId,
      dto,
    );
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("settings")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({
    summary: "Workforce personnel-order org settings (terminate gate)",
  })
  getSettings(@OrganizationId() organizationId: string) {
    return this.orders.getWorkforceOrderSettings(organizationId);
  }

  @Patch("settings")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({
    summary: "Patch settings.workforce.requireOrderIssuedBeforeTerminate only",
  })
  patchSettings(
    @OrganizationId() organizationId: string,
    @Body() dto: PatchPersonnelOrderSettingsDto,
  ) {
    return this.orders.patchWorkforceOrderSettings(organizationId, dto);
  }

  @Get(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.orders.getOne(organizationId, id);
  }

  @Post()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "Create personnel order (optional immediate issue)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreatePersonnelOrderDto,
  ) {
    return this.orders.create(organizationId, user.sub, dto);
  }

  @Post(":id/issue")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  issue(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.orders.issue(organizationId, id, user.sub);
  }

  @Post(":id/cancel")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "Cancel DRAFT personnel order" })
  cancel(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.orders.cancel(organizationId, id, user.sub);
  }

  @Get(":id/pdf")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "Download personnel order PDF" })
  async pdf(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.orders.buildPdfBuffer(
      organizationId,
      id,
      user.sub,
    );
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }
}

@ApiTags("platform-workforce-staff-schedule")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/staff-schedule")
@UseGuards(PermissionsGuard)
export class StaffScheduleRevisionsController {
  constructor(private readonly schedules: StaffScheduleRevisionsService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "List staff schedule revisions (ştat cədvəli)" })
  list(@OrganizationId() organizationId: string) {
    return this.schedules.list(organizationId);
  }

  @Get(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.schedules.getOne(organizationId, id);
  }

  @Post()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "Create staff schedule revision from live slots" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateStaffScheduleRevisionDto,
  ) {
    return this.schedules.create(organizationId, user.sub, dto);
  }

  @Post(":id/submit")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  submit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.schedules.submit(organizationId, id, user.sub);
  }

  @Post(":id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  approve(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.schedules.approve(organizationId, id, user.sub);
  }

  @Get(":id/pdf")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_DOCS)
  @ApiOperation({ summary: "Download staff schedule PDF" })
  async pdf(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.schedules.buildPdfBuffer(
      organizationId,
      id,
    );
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
