import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import {
  LoyaltyService,
  type CreatePromotionInput,
} from "./loyalty.service";

@ApiTags("platform-loyalty")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/loyalty/v1")
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Post("promotions")
  @ApiOperation({ summary: "Create or update promotion (MVP)" })
  createPromotion(
    @OrganizationId() organizationId: string,
    @Body() body: CreatePromotionInput,
  ) {
    return this.loyalty.createPromotion(organizationId, body);
  }

  @Get("promotions")
  @ApiOperation({ summary: "Get promotion by code (MVP smoke)" })
  getPromotion(
    @OrganizationId() organizationId: string,
    @Query("code") code: string,
  ) {
    return this.loyalty.getPromotionByCode(organizationId, code);
  }
}
