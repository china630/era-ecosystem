import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Query,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { INDUSTRY_SATELLITE_KEYS } from "../subscription/satellite-keys.constants";
import { SatelliteEndpointRegistryService } from "./satellite-endpoint-registry.service";

/**
 * S2S peer base URL for cross-satellite HTTP (Finance→Hotel CL, Clinic→Hotel, …).
 * SoR = SatelliteEndpoint (+ fan-out hairpin). Auth: service token family.
 * ADR: docs/adr/satellite-peer-url-resolution.md
 */
@Public()
@Controller("v1/internal/satellites")
export class SatellitePeerEndpointController {
  constructor(private readonly registry: SatelliteEndpointRegistryService) {}

  @Get("peer-endpoint")
  async peerEndpoint(
    @Query("satelliteKey") satelliteKey: string | undefined,
    @Query("organizationId") organizationIdQuery: string | undefined,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
    @Headers("x-organization-id") organizationIdHeader?: string,
  ) {
    assertMatchingServiceToken(authorization, xServiceToken);

    const key = satelliteKey?.trim() ?? "";
    if (!key) {
      throw new BadRequestException("satelliteKey query required");
    }
    if (!(INDUSTRY_SATELLITE_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestException(`Unknown satelliteKey=${key}`);
    }

    const organizationId =
      organizationIdHeader?.trim() || organizationIdQuery?.trim() || "";
    if (!organizationId) {
      throw new BadRequestException(
        "X-Organization-Id header or organizationId query required",
      );
    }

    const row = await this.registry.listForOrg(organizationId);
    const enabled = row.find((r) => r.satelliteKey === key && r.enabled);
    const resolved = await this.registry.resolveEndpoint(organizationId, key);
    if (!resolved?.baseUrl) {
      throw new NotFoundException(
        `No peer endpoint for organizationId=${organizationId} satelliteKey=${key}`,
      );
    }

    return {
      organizationId,
      satelliteKey: key,
      baseUrl: resolved.baseUrl.replace(/\/$/, ""),
      source: enabled ? ("registry" as const) : ("env_fallback" as const),
    };
  }
}
