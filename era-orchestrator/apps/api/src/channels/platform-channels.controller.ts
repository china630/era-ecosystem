import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { PatchChannelDto } from "./dto/patch-channel.dto";
import { SatelliteChannelsService } from "./satellite-channels.service";

@UseGuards(JwtAuthGuard)
@Controller("platform/v1/channels")
export class PlatformChannelsController {
  constructor(private readonly channels: SatelliteChannelsService) {}

  private requireOrg(user: EraJwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return user.organizationId;
  }

  @Get()
  list(@CurrentUser() user: EraJwtPayload) {
    return this.channels.listForOrganization(this.requireOrg(user));
  }

  @Patch(":channelId")
  patch(
    @CurrentUser() user: EraJwtPayload,
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Body() body: PatchChannelDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.channels.acceptorDisable(orgId, channelId, body.enabled === true);
  }
}
