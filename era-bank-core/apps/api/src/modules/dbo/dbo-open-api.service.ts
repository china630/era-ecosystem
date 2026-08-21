import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hashApiKey } from "./dbo-crypto.util";

export type OpenApiKeyConfig = {
  id?: string;
  keyHash: string;
  customerId: string;
  organizationId?: string;
  permissions: string[];
  ipAllowlist?: string[];
  revoked?: boolean;
};

@Injectable()
export class DboOpenApiService {
  private readonly registered = new Map<string, OpenApiKeyConfig>();

  constructor(private readonly config: ConfigService) {}

  registerKey(input: OpenApiKeyConfig): OpenApiKeyConfig {
    const id = input.id ?? input.keyHash;
    const row: OpenApiKeyConfig = { ...input, id, revoked: false };
    this.registered.set(id, row);
    return row;
  }

  revokeKey(id: string): boolean {
    const row = this.registered.get(id);
    if (!row) return false;
    row.revoked = true;
    return true;
  }

  listRegistered(): OpenApiKeyConfig[] {
    return [...this.registered.values()];
  }

  private loadKeys(): OpenApiKeyConfig[] {
    const raw = this.config.get<string>("DBO_OPEN_API_KEYS");
    if (raw) {
      try {
        return JSON.parse(raw) as OpenApiKeyConfig[];
      } catch {
        return [];
      }
    }
    const demoKey = this.config.get<string>("DBO_DEMO_API_KEY") ?? "dbo-demo-api-key-change-in-prod";
    return [
      {
        keyHash: hashApiKey(demoKey),
        customerId: "demo-corporate-customer",
        permissions: ["payments:create", "payments:read", "accounts:read", "payments:submit"],
        ipAllowlist: ["127.0.0.1", "::1", "0.0.0.0"],
      },
    ];
  }

  authenticate(rawKey: string | undefined, clientIp?: string): OpenApiKeyConfig {
    if (!rawKey) throw new UnauthorizedException("X-Api-Key required");
    const keyHash = hashApiKey(rawKey);
    const registered = [...this.registered.values()].find(
      (k) => k.keyHash === keyHash && !k.revoked,
    );
    if (registered) {
      return this.assertIp(registered, clientIp);
    }
    const revoked = [...this.registered.values()].find(
      (k) => k.keyHash === keyHash && k.revoked,
    );
    if (revoked) throw new UnauthorizedException("API key revoked");
    const match = this.loadKeys().find((k) => k.keyHash === keyHash);
    if (!match) throw new UnauthorizedException("Invalid API key");

    return this.assertIp(match, clientIp);
  }

  private assertIp(match: OpenApiKeyConfig, clientIp?: string): OpenApiKeyConfig {
    if (match.ipAllowlist?.length && clientIp) {
      const allowed = match.ipAllowlist.some(
        (ip) => ip === clientIp || ip === "0.0.0.0" || ip === "::1",
      );
      if (!allowed) throw new ForbiddenException("IP not allowlisted");
    }
    return match;
  }

  assertPermission(key: OpenApiKeyConfig, permission: string) {
    if (key.permissions.includes("*") || key.permissions.includes(permission)) return;
    const [domain] = permission.split(":");
    if (key.permissions.includes(`${domain}:*`)) return;
    throw new ForbiddenException(`Missing permission: ${permission}`);
  }
}
