import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { createHash } from "node:crypto";
import { SystemConfigService } from "../system-config/system-config.service";
import type {
  EtaxesSignerContext,
  EtaxesSubmissionAdapter,
  EtaxesSubmissionDestination,
  EtaxesSubmissionResult,
} from "./etaxes-submission.adapter";

export const ETAXES_HSM_URL_KEY = "integrations.etaxes.hsmUrl";
export const ASAN_GATEWAY_URL_KEY = "integrations.asan.gatewayUrl";

/**
 * Default adapter: plain POST to E_TAXES_VAT_SUBMIT_URL (no HSM).
 */
function resolveHttpSubmitUrl(
  config: ConfigService,
  destination: EtaxesSubmissionDestination,
): string | null {
  const byDest: Record<EtaxesSubmissionDestination, string | undefined> = {
    VAT: config.get<string>("E_TAXES_VAT_SUBMIT_URL"),
    PROFIT_TAX: config.get<string>("E_TAXES_PROFIT_SUBMIT_URL"),
    PAYROLL_WITHHOLDING: config.get<string>("E_TAXES_PAYROLL_SUBMIT_URL"),
    DSMF: config.get<string>("E_TAXES_DSMF_SUBMIT_URL"),
    EQAIME: config.get<string>("E_TAXES_EQAIME_SUBMIT_URL"),
  };
  const specific = byDest[destination]?.trim();
  if (specific) return specific;
  const fallback = config.get<string>("E_TAXES_OTHER_SUBMIT_URL")?.trim();
  if (fallback) return fallback;
  if (destination === "VAT") {
    return config.get<string>("E_TAXES_VAT_SUBMIT_URL")?.trim() ?? null;
  }
  return null;
}

@Injectable()
export class HttpEtaxesSubmissionAdapter implements EtaxesSubmissionAdapter {
  private readonly log = new Logger(HttpEtaxesSubmissionAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async submit(
    payload: unknown,
    signer: EtaxesSignerContext,
  ): Promise<EtaxesSubmissionResult> {
    const url = resolveHttpSubmitUrl(this.config, signer.destination);
    if (!url) {
      throw new HttpException(
        {
          code: "E_TAXES_GATEWAY_NOT_CONFIGURED",
          message: `e-taxes gateway URL is not configured for destination ${signer.destination}. Set E_TAXES_${signer.destination}_SUBMIT_URL or E_TAXES_OTHER_SUBMIT_URL.`,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const res = await axios.post(url, payload, {
        timeout: 25_000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return { submitted: true, gatewayStatus: res.status };
      }
      const bodySnippet =
        typeof res.data === "string"
          ? res.data.slice(0, 500)
          : JSON.stringify(res.data).slice(0, 500);
      throw new HttpException(
        {
          code: "E_TAXES_GATEWAY_REJECTED",
          message: `Portal cavabı: HTTP ${res.status}`,
          body: bodySnippet,
        },
        HttpStatus.BAD_GATEWAY,
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (axios.isAxiosError(e)) {
        this.log.warn(`e-taxes gateway network error: ${e.message}`);
        throw new HttpException(
          {
            code: "E_TAXES_GATEWAY_NETWORK",
            message: e.message,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw e;
    }
  }
}

/**
 * HSM + ASAN seam: selected when ERA_ETAXES_HSM_ENABLED=1.
 * Real signing is stubbed until HSM credentials are provisioned;
 * currently returns 503 with clear code so callers know the channel is reserved.
 */
@Injectable()
export class HsmEtaxesSubmissionAdapter implements EtaxesSubmissionAdapter {
  private readonly log = new Logger(HsmEtaxesSubmissionAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async submit(
    payload: unknown,
    signer: EtaxesSignerContext,
  ): Promise<EtaxesSubmissionResult> {
    if (!signer.asanUserId?.trim()) {
      throw new HttpException(
        {
          code: "ASAN_USER_ID_REQUIRED",
          message:
            "Organization.settings.tax.asanUserId is required for HSM/ASAN submission.",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const hsmUrl =
      (await this.systemConfig.getJson(ETAXES_HSM_URL_KEY)) ??
      this.config.get<string>("ERA_HSM_URL")?.trim();
    const asanGateway =
      (await this.systemConfig.getJson(ASAN_GATEWAY_URL_KEY)) ??
      this.config.get<string>("ERA_ASAN_GATEWAY_URL")?.trim();

    const hsmUrlStr =
      typeof hsmUrl === "string"
        ? hsmUrl
        : hsmUrl && typeof hsmUrl === "object" && "url" in (hsmUrl as object)
          ? String((hsmUrl as { url: unknown }).url)
          : "";
    const asanUrlStr =
      typeof asanGateway === "string"
        ? asanGateway
        : asanGateway &&
            typeof asanGateway === "object" &&
            "url" in (asanGateway as object)
          ? String((asanGateway as { url: unknown }).url)
          : "";

    if (!hsmUrlStr || !asanUrlStr) {
      throw new HttpException(
        {
          code: "E_TAXES_HSM_NOT_CONFIGURED",
          message:
            "HSM/ASAN gateway URLs are not configured (system_config integrations.etaxes.hsmUrl / integrations.asan.gatewayUrl or ERA_HSM_URL / ERA_ASAN_GATEWAY_URL).",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    // Seam only: live HSM client lands when partner API is available.
    this.log.warn(
      `HSM submit seam invoked (org=${signer.organizationId}, asan=${signer.asanUserId}, dest=${signer.destination}, payloadSha256=${hash.slice(0, 12)}…). Live HSM client not yet wired.`,
    );

    throw new HttpException(
      {
        code: "E_TAXES_HSM_NOT_READY",
        message:
          "HSM/ASAN submission channel is enabled but the live signing client is not provisioned yet. Use HTTP gateway (ERA_ETAXES_HSM_ENABLED=0) or wait for HSM cutover.",
        signedPayloadHash: hash,
        hsmUrlConfigured: true,
        asanGatewayConfigured: true,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

@Injectable()
export class EtaxesSubmissionAdapterFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpEtaxesSubmissionAdapter,
    private readonly hsm: HsmEtaxesSubmissionAdapter,
  ) {}

  isHsmEnabled(): boolean {
    const raw = this.config.get<string>("ERA_ETAXES_HSM_ENABLED", "0");
    return raw === "1" || raw?.toLowerCase() === "true";
  }

  get(): EtaxesSubmissionAdapter {
    return this.isHsmEnabled() ? this.hsm : this.http;
  }
}
