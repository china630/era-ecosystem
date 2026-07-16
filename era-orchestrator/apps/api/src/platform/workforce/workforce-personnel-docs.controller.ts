import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Body,
  StreamableFile,
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
  CreatePersonnelOrderDto,
  CreateStaffScheduleRevisionDto,
  ListPersonnelOrdersQueryDto,
} from "./dto/workforce-personnel-docs.dto";
import { WorkforcePersonnelOrdersService } from "./workforce-personnel-orders.service";
import { StaffScheduleRevisionsService } from "./staff-schedule-revisions.service";

@ApiTags("platform-workforce-personnel-orders")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/personnel-orders")
@UseGuards(RolesGuard)
export class WorkforcePersonnelOrdersController {
  constructor(private readonly orders: WorkforcePersonnelOrdersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "List personnel orders (hire/transfer/terminate docs)" })
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListPersonnelOrdersQueryDto,
  ) {
    return this.orders.list(organizationId, query);
  }

  @Get(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.orders.getOne(organizationId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Create personnel order (optional immediate issue)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreatePersonnelOrderDto,
  ) {
    return this.orders.create(organizationId, user.sub, dto);
  }

  @Post(":id/issue")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  issue(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.orders.issue(organizationId, id, user.sub);
  }

  @Get(":id/pdf")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Download personnel order PDF" })
  async pdf(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.orders.buildPdfBuffer(
      organizationId,
      id,
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
@UseGuards(RolesGuard)
export class StaffScheduleRevisionsController {
  constructor(private readonly schedules: StaffScheduleRevisionsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "List staff schedule revisions (ştat cədvəli)" })
  list(@OrganizationId() organizationId: string) {
    return this.schedules.list(organizationId);
  }

  @Get(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.schedules.getOne(organizationId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Create staff schedule revision from live slots" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateStaffScheduleRevisionDto,
  ) {
    return this.schedules.create(organizationId, user.sub, dto);
  }

  @Post(":id/submit")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  submit(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.schedules.submit(organizationId, id, user.sub);
  }

  @Post(":id/approve")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  approve(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.schedules.approve(organizationId, id, user.sub);
  }

  @Get(":id/pdf")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
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
