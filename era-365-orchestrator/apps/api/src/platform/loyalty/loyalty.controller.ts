import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { LoyaltyService } from "./loyalty.service";

@ApiTags("platform-loyalty")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/loyalty/v1")
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Post("promotions")
  @ApiOperation({ summary: "Create promotion (stub)" })
  createPromotion(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
  ) {
    return this.loyalty.createPromotion(organizationId, body);
  }
}
