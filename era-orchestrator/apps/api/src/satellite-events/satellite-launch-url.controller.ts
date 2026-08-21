import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrganizationId } from "../common/org-id.decorator";
import { SatelliteEndpointRegistryService } from "./satellite-endpoint-registry.service";

/**
 * Owner launcher: resolve industry satellite base URL from SatelliteEndpoint
 * (production SoR), falling back to NEXT_PUBLIC_* / ERA_*_ORIGIN for local-dev.
 */
@ApiTags("satellites")
@ApiBearerAuth("bearer")
@Controller("v1/satellites")
export class SatelliteLaunchUrlController {
  constructor(private readonly registry: SatelliteEndpointRegistryService) {}

  @Get("launch-url")
  @ApiOperation({
    summary:
      "Resolve owner-launcher base URL for a satellite (registry, then env fallback)",
  })
  async launchUrl(
    @OrganizationId() organizationId: string,
    @Query("satelliteKey") satelliteKey: string | undefined,
  ) {
    const key = satelliteKey?.trim() ?? "";
    if (!key) {
      throw new BadRequestException("satelliteKey is required");
    }
    const resolved = await this.registry.resolveLaunchBaseUrl(
      organizationId,
      key,
    );
    if (!resolved) {
      throw new NotFoundException(
        `No launch URL for satelliteKey=${key} (set SatelliteEndpoint or local-dev env)`,
      );
    }
    return resolved;
  }
}
