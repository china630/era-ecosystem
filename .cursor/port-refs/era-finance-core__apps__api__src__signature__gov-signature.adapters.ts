import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, createHash } from "node:crypto";
import axios from "axios";
import { SignatureProvider } from "@erafinance/database";
import type {
  GovSignatureAdapter,
  GovSignatureOptions,
  GovSignatureResult,
} from "./gov-signature.adapter";

@Injectable()
export class MockGovSignatureAdapter implements GovSignatureAdapter {
  async signPayload(
    payload: Buffer | string,
    opts: GovSignatureOptions,
  ): Promise<GovSignatureResult> {
    const buf = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    const hash = createHash("sha256").update(buf).digest("hex");
    const provider = opts.provider ?? SignatureProvider.ASAN_IMZA;
    return {
      signatureId: `MOCK-GOV-${hash.slice(0, 16)}-${randomBytes(4).toString("hex")}`,
      signedAt: new Date(),
      provider,
      certificateThumbprint: `MOCK-${randomBytes(16).toString("hex")}`,
      certificateSubject: "CN=ERA Mock Gov Signer",
      certificateIssuer:
        provider === SignatureProvider.ASAN_IMZA
          ? "CN=ERA Mock ASAN ─░mza CA"
          : "CN=ERA Mock S─░MA Biometric CA",
    };
  }
}

@Injectable()
export class AsanSimaGovSignatureAdapter implements GovSignatureAdapter {
  private readonly log = new Logger(AsanSimaGovSignatureAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async signPayload(
    payload: Buffer | string,
    opts: GovSignatureOptions,
  ): Promise<GovSignatureResult> {
    const asanUrl = this.config.get<string>("ASAN_IMZA_API_URL")?.trim();
    const simaUrl = this.config.get<string>("SIMA_QR_PAYLOAD_URL")?.trim();
    const provider = opts.provider ?? SignatureProvider.ASAN_IMZA;

    if (!asanUrl && provider === SignatureProvider.ASAN_IMZA) {
      throw new HttpException(
        {
          code: "ASAN_IMZA_NOT_CONFIGURED",
          message: "ASAN_IMZA_API_URL is not configured for live gov signing.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!simaUrl && provider === SignatureProvider.SIMA) {
      throw new HttpException(
        {
          code: "SIMA_NOT_CONFIGURED",
          message: "SIMA_QR_PAYLOAD_URL is not configured for live gov signing.",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const buf = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    const payloadBase64 = buf.toString("base64");
    const endpoint =
      provider === SignatureProvider.SIMA ? simaUrl! : asanUrl!;

    try {
      const res = await axios.post(
        endpoint,
        {
          organizationId: opts.organizationId,
          asanUserId: opts.asanUserId ?? undefined,
          purpose: opts.purpose,
          payloadBase64,
        },
        {
          timeout: 30_000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          validateStatus: () => true,
        },
      );
      if (res.status < 200 || res.status >= 300) {
        const snippet =
          typeof res.data === "string"
            ? res.data.slice(0, 500)
            : JSON.stringify(res.data).slice(0, 500);
        throw new HttpException(
          {
            code: "GOV_SIGNATURE_GATEWAY_REJECTED",
            message: `Gov signature gateway HTTP ${res.status}`,
            body: snippet,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      const data = res.data as Record<string, unknown>;
      const signatureId =
        typeof data.signatureId === "string"
          ? data.signatureId
          : typeof data.id === "string"
            ? data.id
            : null;
      if (!signatureId) {
        throw new HttpException(
          {
            code: "GOV_SIGNATURE_INVALID_RESPONSE",
            message: "Gov signature gateway response missing signatureId",
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      return {
        signatureId,
        signedAt: new Date(
          typeof data.signedAt === "string" ? data.signedAt : Date.now(),
        ),
        provider,
        certificateThumbprint:
          typeof data.certificateThumbprint === "string"
            ? data.certificateThumbprint
            : undefined,
        certificateSubject:
          typeof data.certificateSubject === "string"
            ? data.certificateSubject
            : undefined,
        certificateIssuer:
          typeof data.certificateIssuer === "string"
            ? data.certificateIssuer
            : undefined,
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (axios.isAxiosError(e)) {
        this.log.warn(`Gov signature network error: ${e.message}`);
        throw new HttpException(
          {
            code: "GOV_SIGNATURE_NETWORK",
            message: e.message,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw e;
    }
  }
}

@Injectable()
export class GovSignatureAdapterFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly mock: MockGovSignatureAdapter,
    private readonly live: AsanSimaGovSignatureAdapter,
  ) {}

  isLiveEnabled(): boolean {
    const asanLive = this.config.get<string>("ERA_ASAN_SIMA_LIVE", "0");
    const mockOff = this.config.get<string>("SIGNATURE_GATEWAY_MOCK", "1") === "0";
    return asanLive === "1" || asanLive?.toLowerCase() === "true" || mockOff;
  }

  get(): GovSignatureAdapter {
    return this.isLiveEnabled() ? this.live : this.mock;
  }
}
