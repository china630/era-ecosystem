import { createPublicKey } from "crypto";
import { verify } from "jsonwebtoken";
import type { ConfigService } from "@nestjs/config";
import type { ControlPlaneJwtPayload } from "../types/control-plane-jwt-payload";

type JwksCache = { keys: Record<string, unknown>[]; fetchedAt: number };

let jwksCache: JwksCache | null = null;

async function loadJwks(config: ConfigService): Promise<Record<string, unknown>[]> {
  const uri = config.get<string>("ERA_JWT_JWKS_URL")?.trim();
  if (!uri) return [];
  const ttlMs = 300_000;
  if (jwksCache && Date.now() - jwksCache.fetchedAt < ttlMs) {
    return jwksCache.keys;
  }
  const res = await fetch(uri, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { keys?: Record<string, unknown>[] };
  const keys = data.keys ?? [];
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function pemFromJwk(jwk: Record<string, unknown>): string | null {
  try {
    const keyObject = createPublicKey({ key: jwk, format: "jwk" });
    return keyObject.export({ type: "spki", format: "pem" }) as string;
  } catch {
    return null;
  }
}

export async function verifyControlPlaneAccessToken(
  token: string,
  config: ConfigService,
): Promise<ControlPlaneJwtPayload | null> {
  const issuer =
    config.get<string>("ERA_JWT_ISSUER") ?? "era-365-orchestrator";
  const audience =
    config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ?? "era-finance-core";
  const secret =
    config.get<string>("ERA_JWT_SECRET") ??
    config.get<string>("JWT_SECRET");
  const mode = (config.get<string>("ERA_JWT_VERIFY_MODE") ?? "dual")
    .trim()
    .toLowerCase();

  const opts = { issuer, audience, complete: false as const };

  if (mode !== "rs256" && secret) {
    try {
      return verify(token, secret, {
        ...opts,
        algorithms: ["HS256"],
      }) as ControlPlaneJwtPayload;
    } catch {
      if (mode === "hs256") return null;
    }
  }

  const keys = await loadJwks(config);
  for (const jwk of keys) {
    const pem = pemFromJwk(jwk);
    if (!pem) continue;
    try {
      return verify(token, pem, {
        ...opts,
        algorithms: ["RS256"],
      }) as ControlPlaneJwtPayload;
    } catch {
      /* try next key */
    }
  }
  return null;
}
