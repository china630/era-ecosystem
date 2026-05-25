import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { BookingService } from "./booking.service";

@ApiTags("platform-booking")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/booking/v1")
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Post("slots")
  @ApiOperation({ summary: "Create bookable slots (stub)" })
  createSlots(@OrganizationId() organizationId: string, @Body() body: unknown) {
    return this.booking.createSlots(organizationId, body);
  }

  @Post("appointments")
  @ApiOperation({ summary: "Create appointment (stub)" })
  createAppointment(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
  ) {
    return this.booking.createAppointment(organizationId, body);
  }
}
