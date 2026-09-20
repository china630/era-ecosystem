import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { BusinessTripsService } from "./business-trips.service";
import {
  CreateBusinessTripDto,
  UpdateBusinessTripDto,
} from "./dto/business-trip.dto";

@ApiTags("hr-business-trips")
@ApiBearerAuth("bearer")
@Controller("hr/business-trips")
@UseGuards(PermissionsGuard)
export class BusinessTripsController {
  constructor(private readonly trips: BusinessTripsService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "List business trips" })
  list(
    @OrganizationId() organizationId: string,
    @Query("employeeId") employeeId?: string,
  ) {
    return this.trips.list(organizationId, employeeId);
  }

  @Get(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.trips.getOne(organizationId, id);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateBusinessTripDto,
  ) {
    return this.trips.create(organizationId, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessTripDto,
  ) {
    return this.trips.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.trips.remove(organizationId, id);
  }

  @Post(":id/calculate-per-diem")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Calculate per diem from org norms × calendar days" })
  calculatePerDiem(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.trips.calculatePerDiem(organizationId, id);
  }

  @Post(":id/create-advance")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Create advance report draft from trip per diem" })
  createAdvance(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.trips.createAdvanceFromTrip(organizationId, id);
  }
}
