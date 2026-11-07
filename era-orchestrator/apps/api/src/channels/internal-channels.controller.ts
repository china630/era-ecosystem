import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SatelliteChannelKind } from "@era365/database";
import { Public } from "../auth/decorators/public.decorator";
import { SatelliteChannelsService } from "./satellite-channels.service";

/** S2S channel gate. Skip the user JWT guard; `assertServiceToken` is the auth. */
@Public()
@Controller("v1/internal/channels")
export class InternalChannelsController {
  constructor(
    private readonly channels: SatelliteChannelsService,
    private readonly config: ConfigService,
  ) {}

  private assertServiceToken(header: string | undefined): void {
    const expected =
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() ||
      this.config.get<string>("CONTROL_PLANE_SERVICE_TOKEN")?.trim() ||
      "";
    const got = header?.replace(/^Bearer\s+/i, "").trim() ?? "";
    if (!expected || !got || got !== expected) {
      throw new UnauthorizedException("Service token required");
    }
  }

  @Get()
  list(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Headers("x-organization-id") organizationId: string | undefined,
    @Query("organizationId") organizationIdQuery?: string,
  ) {
    this.assertServiceToken(authorization || xServiceToken);
    const orgId = (organizationId ?? organizationIdQuery ?? "").trim();
    if (!orgId) throw new UnauthorizedException("X-Organization-Id required");
    return this.channels.listForOrganization(orgId);
  }

  /** Static path before `:channelId` so Nest never treats `check` as a UUID. */
  @Get("check")
  async check(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Query("fromOrgId") fromOrgId: string,
    @Query("fromSatelliteKey") fromSatelliteKey: string,
    @Query("toOrgId") toOrgId: string,
    @Query("toSatelliteKey") toSatelliteKey: string,
    @Query("kind") kind: string,
  ) {
    this.assertServiceToken(authorization || xServiceToken);
    const enabled = await this.channels.isEnabled({
      fromOrgId,
      fromSatelliteKey,
      toOrgId,
      toSatelliteKey,
      kind: kind as SatelliteChannelKind,
    });
    return { enabled };
  }

  @Patch(":channelId")
  patch(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Headers("x-organization-id") organizationId: string | undefined,
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Body() body: { enabled?: boolean },
  ) {
    this.assertServiceToken(authorization || xServiceToken);
    const orgId = (organizationId ?? "").trim();
    if (!orgId) throw new UnauthorizedException("X-Organization-Id required");
    return this.channels.acceptorDisable(orgId, channelId, body.enabled === true);
  }
}
