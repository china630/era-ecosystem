import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformAuditService } from "../platform-audit.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";
import { resolveOrganizationUuid } from "../../common/organization-id.util";
import type { ValidateReferenceDataKeyDto } from "./dto/validate-reference-data-key.dto";

const PLATFORM_REFERENCE_DATA = "platform_reference_data";

export type ValidateKeyResult = {
  valid: true;
  organizationId: string;
  metered: boolean;
};

@Injectable()
export class ReferenceDataService {
  private readonly logger = new Logger(ReferenceDataService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly audit: PlatformAuditService,
  ) {}

  private configuredKeys(): Map<string, string> {
    const map = new Map<string, string>();
    const raw =
      this.config.get<string>("REFERENCE_DATA_VALID_API_KEYS") ??
      this.config.get<string>("DATA_HUB_DEV_API_KEYS") ??
      "dev-data-hub-key";
    for (const entry of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      const sep = entry.indexOf(":");
      if (sep > 0) {
        const key = entry.slice(0, sep).trim();
        const org = entry.slice(sep + 1).trim();
        if (key && org) map.set(key, org);
      } else {
        map.set(entry, this.config.get<string>("REFERENCE_DATA_DEFAULT_ORG_ID") ?? "");
      }
    }
    return map;
  }

  async validateKey(dto: ValidateReferenceDataKeyDto): Promise<ValidateKeyResult> {
    const apiKey = dto.apiKey.trim();
    if (!apiKey) {
      throw new BadRequestException("apiKey required");
    }

    const keys = this.configuredKeys();
    const mappedOrg = keys.get(apiKey);
    if (mappedOrg === undefined) {
      throw new UnauthorizedException({ code: "INVALID_API_KEY", message: "Invalid API key" });
    }

    const defaultOrg = this.config.get<string>("REFERENCE_DATA_DEFAULT_ORG_ID")?.trim() ?? "";
    const orgCandidate = dto.organizationId ?? (mappedOrg || defaultOrg);
    const orgId = resolveOrganizationUuid(orgCandidate) ?? orgCandidate;
    if (!orgId) {
      throw new BadRequestException(
        "organizationId required when key is not mapped to an org (REFERENCE_DATA_VALID_API_KEYS=key:orgId)",
      );
    }

    try {
      await this.entitlement.assertPlatformModule(orgId, PLATFORM_REFERENCE_DATA);
    } catch (e) {
      if (this.config.get<string>("REFERENCE_DATA_SKIP_ENTITLEMENT") === "1") {
        this.logger.warn(`reference-data entitlement skipped for org=${orgId}`);
      } else {
        throw e;
      }
    }

    await this.audit.log({
      organizationId: orgId,
      addonSlug: PLATFORM_REFERENCE_DATA,
      action: "validate_api_key",
      idempotencyKey: `validate-key:${apiKey.slice(0, 8)}`,
      payload: { endpoint: "validate-key" },
    });

    this.logger.debug(`reference-data validate-key ok org=${orgId}`);
    return { valid: true, organizationId: orgId, metered: true };
  }
}
