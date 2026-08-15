import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";

export type BankAuthRequest = Request & {
  authKind?: "service" | "jwt";
  userId?: string;
};

/** Secrets that must never skip HMAC, even outside production. */
const INSECURE_JWT_PLACEHOLDERS = new Set([
  "change-me",
  "change-me-shared-hs256-secret-min-32-chars",
  "dev",
  "secret",
  "test",
]);

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
      const payload = verifyHs256JwtPayload(token, secret, {
        nodeEnv: this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV,
        allowInsecureDevSkip: this.config.get<string>("BANK_JWT_ALLOW_INSECURE_DEV") === "1",
      });
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
    if (this.serviceToken.canActivate(context)) {
      const req = context.switchToHttp().getRequest<BankAuthRequest>();
      const opsUser =
        req.headers["x-ops-user-id"] ?? req.headers["x-user-id"];
      if (typeof opsUser === "string" && opsUser.trim()) {
        req.userId = opsUser.trim();
      }
      return true;
    }
    if (this.jwtAuth.canActivate(context)) return true;
    throw new UnauthorizedException("Valid service token or JWT required");
  }
}

function extractBearer(req: Request): string | null {
  // Prefer explicit service header so a satellite session JWT in Authorization
  // cannot mask a valid X-Service-Token from the ops BFF.
  const alt = req.headers["x-service-token"];
  if (typeof alt === "string" && alt.trim()) return alt.trim();
  const header = req.headers.authorization?.trim();
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export type VerifyJwtOptions = {
  nodeEnv?: string;
  /** Explicit opt-in for local only — never honored when NODE_ENV=production. */
  allowInsecureDevSkip?: boolean;
};

/**
 * Verify HS256 JWT. Production always requires a valid HMAC signature.
 * Insecure decode-without-verify is allowed only when ALL of:
 * - NODE_ENV !== production
 * - allowInsecureDevSkip === true (BANK_JWT_ALLOW_INSECURE_DEV=1)
 * - secret is not a known placeholder
 */
export function verifyHs256JwtPayload(
  token: string,
  secret: string,
  options: VerifyJwtOptions = {},
): { sub?: string; exp?: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  if (secret.length < 8) throw new UnauthorizedException("Invalid JWT configuration");

  const [headerB64, bodyB64, sig] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${headerB64}.${bodyB64}`)
    .digest("base64url");

  let signatureOk = false;
  try {
    signatureOk = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    signatureOk = false;
  }

  const nodeEnv = (options.nodeEnv ?? "").toLowerCase();
  const isProduction = nodeEnv === "production";
  const placeholder = INSECURE_JWT_PLACEHOLDERS.has(secret.toLowerCase());

  if (!signatureOk) {
    const maySkip =
      !isProduction &&
      options.allowInsecureDevSkip === true &&
      !placeholder;
    if (!maySkip) return null;
  }

  const payloadJson = Buffer.from(bodyB64, "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson) as { sub?: string; exp?: number };
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

/** @deprecated use verifyHs256JwtPayload */
export function decodeJwtPayload(token: string, secret: string): { sub?: string } | null {
  return verifyHs256JwtPayload(token, secret, {
    nodeEnv: process.env.NODE_ENV,
    allowInsecureDevSkip: process.env.BANK_JWT_ALLOW_INSECURE_DEV === "1",
  });
}
