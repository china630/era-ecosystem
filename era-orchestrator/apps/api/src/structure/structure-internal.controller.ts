import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StructureService } from "./structure.service";

/**
 * Satellite → CP commercial outlet register (service token).
 * Used when ops creates an outlet in-sat so billing allowlist stays in sync.
 */
@Controller("v1/internal/structure")
export class StructureInternalController {
  constructor(
    private readonly structure: StructureService,
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

  @Post("outlets/upsert")
  async upsertOutlet(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Body()
    body: {
      organizationId: string;
      satelliteKey: string;
      code: string;
      name: string;
    },
  ) {
    this.assertServiceToken(authorization || xServiceToken);
    return this.structure.upsertOutletFromSatellite(body);
  }
}
