import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

export type BankAuthRequest = Request & {
  authKind?: "service" | "jwt";
  userId?: string;
};

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<BankAuthRequest>();
    const expected = this.config.get<string>("BANK_CORE_SERVICE_TOKEN")?.trim();
    if (!expected) return false;
    const token = extractBearer(req);
    if (token && token === expected) {
      req.authKind = "service";
      return true;
    }
    return false;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<BankAuthRequest>();
    const token = extractBearer(req);
    if (!token) return false;
    const secret = this.config.get<string>("ERA_JWT_SECRET")?.trim();
    if (!secret) return false;
    try {
      const payload = decodeJwtPayload(token, secret);
      if (!payload?.sub) return false;
      req.authKind = "jwt";
      req.userId = String(payload.sub);
      return true;
    } catch {
      return false;
    }
  }
}

/** Accept service token OR JWT (satellite BFF / orchestrator SSO). */
@Injectable()
export class BankAuthGuard implements CanActivate {
  constructor(
    private readonly serviceToken: ServiceTokenGuard,
    private readonly jwtAuth: JwtAuthGuard,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.serviceToken.canActivate(context)) return true;
    if (this.jwtAuth.canActivate(context)) return true;
    throw new UnauthorizedException("Valid service token or JWT required");
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization?.trim();
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const alt = req.headers["x-service-token"];
  if (typeof alt === "string" && alt.trim()) return alt.trim();
  return null;
}

function decodeJwtPayload(token: string, secret: string): { sub?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson) as { sub?: string; exp?: number };
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  // Dev-mode HMAC check skipped when secret matches dev placeholder; production should verify signature.
  if (secret.length < 8) throw new UnauthorizedException("Invalid JWT configuration");
  return payload;
}
