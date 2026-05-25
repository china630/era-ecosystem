import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { PaymentsService } from "./payments.service";

@ApiTags("platform-payments")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/payments/v1")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("payment-links")
  @ApiOperation({ summary: "Create payment link (stub)" })
  createPaymentLink(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
  ) {
    return this.payments.createPaymentLink(organizationId, body);
  }
}
