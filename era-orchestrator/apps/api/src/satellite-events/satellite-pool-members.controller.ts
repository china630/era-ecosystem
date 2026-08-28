import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertInternalServiceToken } from "../common/utils/internal-service-token.util";
import { SatelliteEndpointRegistryService } from "./satellite-endpoint-registry.service";

/**
 * Satellite cron / pool self-identity: list org UUIDs on this process URL.
 * Auth: SATELLITE_EVENT_SERVICE_TOKEN (Bearer or x-service-token).
 */
@Public()
@Controller("v1/internal/satellite-pool")
export class SatellitePoolMembersController {
  constructor(private readonly registry: SatelliteEndpointRegistryService) {}

  @Get("members")
  async listMembers(
    @Query("satelliteKey") satelliteKey: string | undefined,
    @Query("baseUrl") baseUrl: string | undefined,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    assertInternalServiceToken(
      authorization,
      "SATELLITE_EVENT_SERVICE_TOKEN",
      xServiceToken,
    );
    const key = satelliteKey?.trim() ?? "";
    const url = baseUrl?.trim() ?? "";
    if (!key || !url) {
      throw new BadRequestException("satelliteKey and baseUrl required");
    }
    const organizationIds = await this.registry.listOrganizationIdsByEndpoint({
      satelliteKey: key,
      baseUrl: url,
    });
    return {
      organizationIds,
      satelliteKey: key,
      baseUrl: url.replace(/\/$/, ""),
    };
  }
}
