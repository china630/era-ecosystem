import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { ReferralsService } from "./referrals.service";

@ApiTags("partner")
@ApiBearerAuth("bearer")
@Controller("v1/partner")
@UseGuards(JwtAuthGuard)
export class PartnerReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get("dashboard")
  @ApiOperation({
    summary:
      "Partner dashboard (user must be linked as Partner.ownerUserId)",
  })
  dashboard(@CurrentUser() user: EraJwtPayload) {
    return this.referrals.getPartnerDashboard(user.sub);
  }

  @Get("qr.png")
  @ApiOperation({ summary: "Partner referral QR (PNG)" })
  @ApiProduces("image/png")
  async partnerQr(
    @CurrentUser() user: EraJwtPayload,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const buf = await this.referrals.renderPartnerQrPngForOwnerUser(user.sub);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  }
}
