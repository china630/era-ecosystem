import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import {
  BookingService,
  type CreateAppointmentInput,
  type CreateSlotInput,
} from "./booking.service";

@ApiTags("platform-booking")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/booking/v1")
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Get("slots")
  @ApiOperation({ summary: "List bookable slots (optional resourceKey filter)" })
  listSlots(
    @OrganizationId() organizationId: string,
    @Query("resourceKey") resourceKey?: string,
  ) {
    return this.booking.listSlots(organizationId, resourceKey);
  }

  @Post("slots")
  @ApiOperation({ summary: "Create bookable slots" })
  createSlots(
    @OrganizationId() organizationId: string,
    @Body() body: CreateSlotInput,
  ) {
    return this.booking.createSlots(organizationId, body);
  }

  @Post("appointments")
  @ApiOperation({ summary: "Create appointment" })
  createAppointment(
    @OrganizationId() organizationId: string,
    @Body() body: CreateAppointmentInput,
  ) {
    return this.booking.createAppointment(organizationId, body);
  }
}