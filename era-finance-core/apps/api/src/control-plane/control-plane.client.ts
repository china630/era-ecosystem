import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ValidateEntitlementResponse } from "./control-plane.types";
import {
  resolveControlPlaneServiceToken,
  resolveOrchestratorInternalUrl,
} from "./control-plane-credentials";

@Injectable()
export class ControlPlaneClient {
  private readonly logger = new Logger(ControlPlaneClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Re-resolve each call so Sync runtime-config updates are visible without restart. */
  private baseUrl(): string {
    return (
      resolveOrchestratorInternalUrl(this.config) || "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
  }

  private serviceToken(): string | undefined {
    return (
      resolveControlPlaneServiceToken(this.config) ||
      this.config.get<string>("ORCHESTRATOR_SERVICE_TOKEN")?.trim() ||
      undefined
    );
  }

  get rbacProxyEnabled(): boolean {
    return (
      (process.env.ERA_CONTROL_PLANE_RBAC_PROXY ?? "true").toLowerCase() !==
      "false"
    );
  }

  async forward<T>(input: {
    method: string;
    path: string;
    body?: unknown;
    authorization?: string;
  }): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = this.serviceToken();
    if (input.authorization) {
      headers.Authorization = input.authorization;
    } else if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseUrl()}${input.path}`, {
      method: input.method,
      headers,
      body:
        input.body !== undefined ? JSON.stringify(input.body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }
    if (!res.ok) {
      const err = new Error(
        `Control plane ${input.method} ${input.path} failed: ${res.status}`,
      ) as Error & { status?: number; response?: unknown };
      err.status = res.status;
      err.response = json;
      throw err;
    }
    return json as T;
  }

  async assertQuota(input: {
    organizationId: string;
    kind: "employee" | "storage" | "invoice" | "whatsapp" | "ocr";
    quantity?: number;
    additionalBytes?: number;
  }): Promise<void> {
    await this.forward({
      method: "POST",
      path: "/internal/v1/quota/assert",
      body: input,
    });
  }

  async linkOrganizationMdm(input: {
    organizationId: string;
    name: string;
    taxId: string;
  }): Promise<void> {
    const enabled =
      (process.env.ERA_MDM_REGISTER_VIA_ORCH ?? "true").toLowerCase() !==
      "false";
    const token = this.serviceToken();
    if (!enabled || !token) return;
    try {
      await fetch(`${this.baseUrl()}/internal/v1/mdm/organizations/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-token": token,
        },
        body: JSON.stringify(input),
      });
    } catch (err) {
      this.logger.warn(
        `MDM link failed for org ${input.organizationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Verify email+password against Orchestrator so SSO users can use the Finance login form. */
  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: string };
      return data.accessToken?.trim() || null;
    } catch (err) {
      this.logger.warn(
        `Orchestrator password login failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * Fetch control-plane org profile (name + decrypted VÖEN) so Finance can
   * provision a local organization row on SSO ingress. Service-token protected.
   */
  async fetchOrganizationDetails(organizationId: string): Promise<{
    organizationId: string;
    name: string;
    taxId: string | null;
  } | null> {
    const token = this.serviceToken();
    if (!token) return null;
    try {
      const res = await fetch(
        `${this.baseUrl()}/internal/v1/mdm/organizations/${encodeURIComponent(
          organizationId,
        )}/details`,
        {
          method: "GET",
          headers: { "x-service-token": token },
        },
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        organizationId: string;
        name: string;
        taxId: string | null;
      };
    } catch (err) {
      this.logger.warn(
        `Control plane org details failed for ${organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  async attachReferralOnSignup(input: {
    organizationId: string;
    organizationCreatedAt: string;
    referralCode?: string | null;
  }): Promise<void> {
    await this.forward({
      method: "POST",
      path: "/internal/v1/referrals/attach-on-signup",
      body: input,
    });
  }

  async provisionTrialSubscription(input: {
    organizationId: string;
    organizationCreatedAt: string;
  }): Promise<void> {
    await this.forward({
      method: "POST",
      path: "/internal/v1/subscription/provision-trial",
      body: input,
    });
  }

  async getSubscriptionSnapshot(organizationId: string): Promise<{
    tier: string;
    activeModules: string[];
    customConfig: unknown | null;
    modules: Record<string, boolean>;
    expiresAt: string | null;
    isTrial: boolean;
  }> {
    const q = encodeURIComponent(organizationId);
    return this.forward({
      method: "GET",
      path: `/internal/v1/subscription/snapshot?organizationId=${q}`,
    });
  }

  async validateEntitlement(input: {
    organizationId: string;
    userId?: string;
    method: string;
    path: string;
    isSuperAdmin?: boolean;
  }): Promise<ValidateEntitlementResponse | null> {
    const base = this.baseUrl();
    const token = this.serviceToken();
    try {
      const res = await fetch(`${base}/internal/v1/entitlements/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        this.logger.warn(
          `Control plane validate failed: ${res.status} ${res.statusText}`,
        );
        return null;
      }
      return (await res.json()) as ValidateEntitlementResponse;
    } catch (err) {
      this.logger.warn(
        `Control plane unreachable at ${base}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
