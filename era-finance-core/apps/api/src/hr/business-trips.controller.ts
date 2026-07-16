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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { BusinessTripsService } from "./business-trips.service";
import {
  CreateBusinessTripDto,
  UpdateBusinessTripDto,
} from "./dto/business-trip.dto";

@ApiTags("hr-business-trips")
@ApiBearerAuth("bearer")
@Controller("hr/business-trips")
@UseGuards(RolesGuard)
export class BusinessTripsController {
  constructor(private readonly trips: BusinessTripsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  @ApiOperation({ summary: "List business trips" })
  list(
    @OrganizationId() organizationId: string,
    @Query("employeeId") employeeId?: string,
  ) {
    return this.trips.list(organizationId, employeeId);
  }

  @Get(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.trips.getOne(organizationId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateBusinessTripDto,
  ) {
    return this.trips.create(organizationId, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessTripDto,
  ) {
    return this.trips.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.trips.remove(organizationId, id);
  }

  @Post(":id/calculate-per-diem")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  @ApiOperation({ summary: "Calculate per diem from org norms × calendar days" })
  calculatePerDiem(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.trips.calculatePerDiem(organizationId, id);
  }

  @Post(":id/create-advance")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  @ApiOperation({ summary: "Create advance report draft from trip per diem" })
  createAdvance(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.trips.createAdvanceFromTrip(organizationId, id);
  }
}
