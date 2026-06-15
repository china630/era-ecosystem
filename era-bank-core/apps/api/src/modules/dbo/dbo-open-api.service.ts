import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hashApiKey } from "./dbo-crypto.util";

export type OpenApiKeyConfig = {
  keyHash: string;
  customerId: string;
  permissions: string[];
  ipAllowlist?: string[];
};

@Injectable()
export class DboOpenApiService {
  constructor(private readonly config: ConfigService) {}

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
    const match = this.loadKeys().find((k) => k.keyHash === keyHash);
    if (!match) throw new UnauthorizedException("Invalid API key");

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
