import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  resolveControlPlaneServiceToken,
  resolveOrchestratorInternalUrl,
} from "./control-plane-credentials";

export type OrgAccessMaterial = {
  code: string;
  publicFields: Record<string, string>;
  secret: string | null;
};

@Injectable()
export class OrgAccessClient {
  private readonly logger = new Logger(OrgAccessClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Null when the platform has no active key for this org. Does not log the secret. */
  async get(organizationId: string, code: string): Promise<OrgAccessMaterial | null> {
    const base = (
      resolveOrchestratorInternalUrl(this.config) || "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
    const token = resolveControlPlaneServiceToken(this.config);
    if (!token) {
      this.logger.warn("org access read skipped: control-plane service token is empty");
      return null;
    }
    const url = `${base}/internal/v1/organizations/${encodeURIComponent(organizationId)}/access/${encodeURIComponent(code)}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-service-token": token,
          Accept: "application/json",
        },
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        this.logger.warn(`org access read ${code} failed: HTTP ${res.status}`);
        return null;
      }
      const body = (await res.json()) as OrgAccessMaterial;
      return {
        code: body.code,
        publicFields: body.publicFields ?? {},
        secret: typeof body.secret === "string" && body.secret.trim() ? body.secret : null,
      };
    } catch (err) {
      this.logger.warn(
        `org access read ${code} unreachable: ${err instanceof Error ? err.message : "network"}`,
      );
      return null;
    }
  }

  async resolveAsanUserId(organizationId: string, settingsJson: unknown): Promise<string | null> {
    const row = await this.get(organizationId, "GOV_ETAXES");
    const fromPlatform = row?.publicFields.asanUserId?.trim();
    if (fromPlatform) return fromPlatform;
    if (!settingsJson || typeof settingsJson !== "object") return null;
    const tax = (settingsJson as Record<string, unknown>).tax;
    if (!tax || typeof tax !== "object") return null;
    const id = (tax as Record<string, unknown>).asanUserId;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }

  /** Portal calls that do not exist yet still read the org key through the same client. */
  customs(organizationId: string) {
    return this.get(organizationId, "GOV_CUSTOMS");
  }

  migration(organizationId: string) {
    return this.get(organizationId, "GOV_MIGRATION");
  }

  dsmf(organizationId: string) {
    return this.get(organizationId, "GOV_DSMF");
  }
}
