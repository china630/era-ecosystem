import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";

/**
 * Satellite pull of CP desired-state (Wave 6).
 * Auth: same handshake family as fan-out / catalog (SATELLITE_EVENT + CONTROL_PLANE).
 * Requires enabled SatelliteEndpoint row for organizationId + satelliteKey
 * (cluster-wide token must not read arbitrary orgs).
 */
@Public()
@Controller("v1/internal/satellites")
export class SatelliteDesiredStateController {
  constructor(private readonly sync: SatelliteOrgBindSyncService) {}

  @Get("desired-state")
  async getDesiredState(
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

    const organizationId =
      organizationIdHeader?.trim() || organizationIdQuery?.trim() || "";
    if (!organizationId) {
      throw new BadRequestException(
        "X-Organization-Id header or organizationId query required",
      );
    }

    return this.sync.getDesiredState({ organizationId, satelliteKey: key });
  }
}
