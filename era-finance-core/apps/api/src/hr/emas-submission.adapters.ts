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
import {
  ETAXES_HSM_URL_KEY,
  ASAN_GATEWAY_URL_KEY,
} from "../reporting/etaxes-submission.adapters";
import type {
  EmasSignerContext,
  EmasSubmissionAdapter,
  EmasSubmissionResult,
} from "./emas-submission.adapter";

type EmasLifecycleOp = "hire" | "transfer" | "terminate";

function extractExternalId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const candidates = [o.externalId, o.emasExternalId, o.contractId, o.id];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

@Injectable()
export class HttpEmasSubmissionAdapter implements EmasSubmissionAdapter {
  private readonly log = new Logger(HttpEmasSubmissionAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string | null {
    return this.config.get<string>("EMAS_SUBMIT_URL")?.trim() ?? null;
  }

  private async postOp(
    op: EmasLifecycleOp,
    payload: unknown,
  ): Promise<EmasSubmissionResult> {
    const base = this.baseUrl();
    if (!base) {
      throw new HttpException(
        {
          code: "EMAS_GATEWAY_NOT_CONFIGURED",
          message:
            "EMAS_SUBMIT_URL is not configured. Use browser extension RPA or Excel fallback.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const url = `${base.replace(/\/$/, "")}/${op}`;
    try {
      const res = await axios.post(url, payload, {
        timeout: 30_000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return {
          submitted: true,
          gatewayStatus: res.status,
          externalId: extractExternalId(res.data),
          gatewayMessage:
            typeof res.data === "object" && res.data && "message" in res.data
              ? String((res.data as { message: unknown }).message)
              : undefined,
        };
      }
      const bodySnippet =
        typeof res.data === "string"
          ? res.data.slice(0, 500)
          : JSON.stringify(res.data).slice(0, 500);
      throw new HttpException(
        {
          code: "EMAS_GATEWAY_REJECTED",
          message: `ƏMAS portal response: HTTP ${res.status}`,
          body: bodySnippet,
        },
        HttpStatus.BAD_GATEWAY,
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (axios.isAxiosError(e)) {
        this.log.warn(`ƏMAS gateway network error: ${e.message}`);
        throw new HttpException(
          { code: "EMAS_GATEWAY_NETWORK", message: e.message },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw e;
    }
  }

  submitHire(payload: unknown, _signer: EmasSignerContext) {
    return this.postOp("hire", payload);
  }

  submitTransfer(payload: unknown, _signer: EmasSignerContext) {
    return this.postOp("transfer", payload);
  }

  submitTerminate(payload: unknown, _signer: EmasSignerContext) {
    return this.postOp("terminate", payload);
  }
}

@Injectable()
export class HsmEmasSubmissionAdapter implements EmasSubmissionAdapter {
  private readonly log = new Logger(HsmEmasSubmissionAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  private async submitViaHsmSeam(
    op: EmasLifecycleOp,
    payload: unknown,
    signer: EmasSignerContext,
  ): Promise<EmasSubmissionResult> {
    if (!signer.asanUserId?.trim()) {
      throw new HttpException(
        {
          code: "ASAN_USER_ID_REQUIRED",
          message:
            "Organization.settings.tax.asanUserId is required for HSM/ASAN ƏMAS submission.",
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
          code: "EMAS_HSM_NOT_CONFIGURED",
          message:
            "HSM/ASAN gateway URLs are not configured. Use RPA/Excel fallback or configure ERA_HSM_URL / ERA_ASAN_GATEWAY_URL.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const hash = createHash("sha256")
      .update(JSON.stringify({ op, payload }))
      .digest("hex");

    this.log.warn(
      `ƏMAS HSM seam invoked (org=${signer.organizationId}, op=${op}, asan=${signer.asanUserId}, payloadSha256=${hash.slice(0, 12)}…). Live HSM client not yet wired.`,
    );

    throw new HttpException(
      {
        code: "EMAS_HSM_NOT_READY",
        message:
          "ƏMAS S2S HSM channel is enabled but the live signing client is not provisioned yet. Use ERA_EMAS_S2S_ENABLED=0 with RPA/Excel fallback.",
        signedPayloadHash: hash,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  submitHire(payload: unknown, signer: EmasSignerContext) {
    return this.submitViaHsmSeam("hire", payload, signer);
  }

  submitTransfer(payload: unknown, signer: EmasSignerContext) {
    return this.submitViaHsmSeam("transfer", payload, signer);
  }

  submitTerminate(payload: unknown, signer: EmasSignerContext) {
    return this.submitViaHsmSeam("terminate", payload, signer);
  }
}

@Injectable()
export class EmasSubmissionAdapterFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpEmasSubmissionAdapter,
    private readonly hsm: HsmEmasSubmissionAdapter,
  ) {}

  isEnabled(): boolean {
    const raw = this.config.get<string>("ERA_EMAS_S2S_ENABLED", "0");
    return raw === "1" || raw?.toLowerCase() === "true";
  }

  /** Throws 503 when S2S flag is off — callers should direct users to RPA/Excel. */
  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new HttpException(
        {
          code: "EMAS_S2S_DISABLED",
          message:
            "ƏMAS server-to-server is disabled (ERA_EMAS_S2S_ENABLED=0). Use browser extension RPA or Excel bulk import fallback.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  get(): EmasSubmissionAdapter {
    const hsmFlag = this.config.get<string>("ERA_ETAXES_HSM_ENABLED", "0");
    const useHsm = hsmFlag === "1" || hsmFlag?.toLowerCase() === "true";
    return useHsm ? this.hsm : this.http;
  }
}
