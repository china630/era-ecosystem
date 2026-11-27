import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  UnauthorizedException,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { SystemConfigService } from "../system-config/system-config.service";

const ALLOWED = new Set([
  "site.origin",
  "site.app_origin",
  "site.crm_origin",
  "site.crm_internal_url",
  "site.demo_form_public_id",
  "site.demo_form_webhook_secret",
  "site.crm_organization_id",
  "site.contact_phone",
  "site.contact_phone_e164",
  "site.contact_email",
  "site.contact_address",
  "site.legal_name",
  "site.voen",
  "site.trust_blocks_enabled",
  "site.catalog_cache_version",
]);

/**
 * Server-to-server read of site system_config for Next demo-request / SSR contacts.
 * Auth: Bearer SATELLITE_EVENT_SERVICE_TOKEN (or ORCHESTRATOR_INTERNAL_SERVICE_TOKEN).
 */
@Public()
@Controller("v1/internal/site-config")
export class InternalSiteConfigController {
  constructor(private readonly systemConfig: SystemConfigService) {}

  @Get(":key")
  async get(
    @Param("key") key: string,
    @Headers("authorization") authorization?: string,
  ) {
    const decoded = decodeURIComponent(key);
    if (!ALLOWED.has(decoded)) {
      throw new NotFoundException();
    }
    const expected =
      process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
      process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN?.trim() ||
      "";
    const bearer = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
    if (expected) {
      if (!bearer || bearer !== expected) {
        throw new UnauthorizedException();
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("service token required");
    }

    if (decoded === "site.demo_form_webhook_secret") {
      const plain = await this.systemConfig.getSecretPlain(decoded);
      return { key: decoded, value: plain ?? "" };
    }
    const value = await this.systemConfig.getJson(decoded);
    return { key: decoded, value: value ?? "" };
  }
}
