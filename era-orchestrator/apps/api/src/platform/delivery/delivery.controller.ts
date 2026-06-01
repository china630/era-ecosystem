import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import {
  DeliveryService,
  type CreateShipmentInput,
} from "./delivery.service";

@ApiTags("platform-delivery")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/delivery/v1")
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post("shipments")
  @ApiOperation({ summary: "Create shipment (MVP)" })
  createShipment(
    @OrganizationId() organizationId: string,
    @Body() body: CreateShipmentInput,
  ) {
    return this.delivery.createShipment(organizationId, body);
  }

  @Patch("shipments/:id/status")
  @ApiOperation({ summary: "Advance shipment status (Live carrier machine)" })
  advanceStatus(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() body: { status?: string },
  ) {
    return this.delivery.advanceStatus(
      organizationId,
      id,
      body.status as never,
    );
  }
}
