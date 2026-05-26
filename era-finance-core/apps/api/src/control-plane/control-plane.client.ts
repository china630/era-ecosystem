import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ValidateEntitlementResponse } from "./control-plane.types";

@Injectable()
export class ControlPlaneClient {
  private readonly logger = new Logger(ControlPlaneClient.name);
  private readonly baseUrl: string;
  private readonly serviceToken: string | undefined;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>("CONTROL_PLANE_URL") ?? "http://127.0.0.1:4100"
    ).replace(/\/$/, "");
    this.serviceToken = config.get<string>("CONTROL_PLANE_SERVICE_TOKEN");
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
    if (input.authorization) {
      headers.Authorization = input.authorization;
    } else if (this.serviceToken) {
      headers.Authorization = `Bearer ${this.serviceToken}`;
    }
    const res = await fetch(`${this.baseUrl}${input.path}`, {
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
    if (!enabled || !this.serviceToken) return;
    try {
      await fetch(`${this.baseUrl}/internal/v1/mdm/organizations/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-token": this.serviceToken,
        },
        body: JSON.stringify(input),
      });
    } catch (err) {
      this.logger.warn(
        `MDM link failed for org ${input.organizationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
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
    try {
      const res = await fetch(
        `${this.baseUrl}/internal/v1/entitlements/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.serviceToken
              ? { Authorization: `Bearer ${this.serviceToken}` }
              : {}),
          },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `Control plane validate failed: ${res.status} ${res.statusText}`,
        );
        return null;
      }
      return (await res.json()) as ValidateEntitlementResponse;
    } catch (err) {
      this.logger.warn(
        `Control plane unreachable at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
