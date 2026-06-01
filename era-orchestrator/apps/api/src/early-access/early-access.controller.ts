import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrganizationId } from "../common/org-id.decorator";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { EarlyAccessService } from "./early-access.service";
import { RecordEarlyAccessEventDto } from "./dto/record-event.dto";
import { EarlyAccessSignupDto } from "./dto/signup.dto";

@ApiTags("early-access")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("v1/early-access")
export class EarlyAccessController {
  constructor(private readonly earlyAccess: EarlyAccessService) {}

  @Post("events")
  @ApiOperation({ summary: "Record painted-door funnel event (high volume; not audit-logged)" })
  async recordEvent(
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: RecordEarlyAccessEventDto,
    @Req() req: Request,
  ) {
    return this.earlyAccess.recordEvent(user, dto, req);
  }

  @Post("signup")
  @ApiOperation({ summary: "Join early access waitlist (idempotent per org + module)" })
  async signup(
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: EarlyAccessSignupDto,
    @Req() req: Request,
  ) {
    return this.earlyAccess.signup(user, dto, req);
  }

  @Get("me")
  @ApiOperation({ summary: "Current org waitlist rows" })
  async me(@OrganizationId() organizationId: string) {
    return this.earlyAccess.listMine(organizationId);
  }
}
