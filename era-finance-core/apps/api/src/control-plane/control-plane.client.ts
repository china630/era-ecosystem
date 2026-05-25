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
