import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CP_PERMISSION } from "../auth/cp-permissions";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { PatchChannelDto } from "./dto/patch-channel.dto";
import { SatelliteChannelsService } from "./satellite-channels.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/organizations/:orgId/channels")
export class AdminChannelsController {
  constructor(private readonly channels: SatelliteChannelsService) {}

  @Get()
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.channels.listForOrganization(orgId);
  }

  @Post("resync")
  async resync(@Param("orgId", ParseUUIDPipe) orgId: string) {
    await this.channels.syncPlatformChannels(orgId);
    return this.channels.listForOrganization(orgId);
  }

  @Patch(":channelId")
  patch(
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Body() body: PatchChannelDto,
  ) {
    return this.channels.adminPatch(channelId, body);
  }
}

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/channels")
export class AdminChannelsBatchController {
  constructor(private readonly channels: SatelliteChannelsService) {}

  @Post("resync-all")
  resyncAll() {
    return this.channels.syncPlatformChannelsAll();
  }
}
