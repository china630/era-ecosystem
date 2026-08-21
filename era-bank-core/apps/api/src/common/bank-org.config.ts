import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  resolveSatelliteOrganizationId,
  setRuntimeOrganizationId,
} from "@era/satellite-kit";

/**
 * Bank deployment org. Boot may seed runtime from ERA_BANK_ORGANIZATION_ID
 * (emergency override); request-time reads use kit resolver.
 */
@Injectable()
export class BankOrgConfig {
  constructor(config: ConfigService) {
    const fromEnv =
      config.get<string>("ERA_BANK_ORGANIZATION_ID")?.trim() ||
      config.get<string>("ERA_SATELLITE_ORGANIZATION_ID")?.trim();
    if (fromEnv) setRuntimeOrganizationId(fromEnv);
  }

  get bankOrgId(): string {
    const { organizationId, source } = resolveSatelliteOrganizationId({
      allowFallback: true,
    });
    if (source === "fallback") {
      throw new Error(
        "Bank organizationId is required (Sync bind or ERA_BANK_ORGANIZATION_ID)",
      );
    }
    return organizationId;
  }
}
