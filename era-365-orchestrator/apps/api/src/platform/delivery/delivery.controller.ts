import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { DeliveryService } from "./delivery.service";

@ApiTags("platform-delivery")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/delivery/v1")
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post("shipments")
  @ApiOperation({ summary: "Create shipment (stub)" })
  createShipment(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
  ) {
    return this.delivery.createShipment(organizationId, body);
  }
}
