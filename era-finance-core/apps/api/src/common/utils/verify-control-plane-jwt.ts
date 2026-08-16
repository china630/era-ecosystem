import { createPublicKey } from "crypto";
import { verify } from "jsonwebtoken";
import type { ConfigService } from "@nestjs/config";
import type { ControlPlaneJwtPayload } from "../types/control-plane-jwt-payload";

type JwksCache = { keys: Record<string, unknown>[]; fetchedAt: number };

let jwksCache: JwksCache | null = null;

const DEFAULT_JWKS_URL = "http://127.0.0.1:4000/.well-known/jwks.json";

export function resetControlPlaneJwksCache(): void {
  jwksCache = null;
}

async function loadJwks(config: ConfigService): Promise<Record<string, unknown>[]> {
  const uri = (
    config.get<string>("ERA_JWT_JWKS_URL")?.trim() || DEFAULT_JWKS_URL
  ).replace(/\/$/, "");
  const ttlMs = 300_000;
  if (jwksCache && Date.now() - jwksCache.fetchedAt < ttlMs) {
    return jwksCache.keys;
  }
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { keys?: Record<string, unknown>[] };
    const keys = data.keys ?? [];
    jwksCache = { keys, fetchedAt: Date.now() };
    return keys;
  } catch {
    return [];
  }
}

function pemFromJwk(jwk: Record<string, unknown>): string | null {
  try {
    const keyObject = createPublicKey({ key: jwk, format: "jwk" });
    return keyObject.export({ type: "spki", format: "pem" }) as string;
  } catch {
    return null;
  }
}

function hs256Secrets(config: ConfigService): string[] {
  const secrets = [
    config.get<string>("ERA_JWT_SECRET")?.trim(),
    config.get<string>("JWT_SECRET")?.trim(),
  ].filter((s): s is string => Boolean(s));
  return [...new Set(secrets)];
}

export async function verifyControlPlaneAccessToken(
  token: string,
  config: ConfigService,
): Promise<ControlPlaneJwtPayload | null> {
  const issuer =
    config.get<string>("ERA_JWT_ISSUER") ?? "era-orchestrator";
  const audience =
    config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ?? "era-finance-core";
  const mode = (config.get<string>("ERA_JWT_VERIFY_MODE") ?? "dual")
    .trim()
    .toLowerCase();

  const opts = { issuer, audience, complete: false as const };

  if (mode !== "rs256") {
    for (const secret of hs256Secrets(config)) {
      try {
        return verify(token, secret, {
          ...opts,
          algorithms: ["HS256"],
        }) as ControlPlaneJwtPayload;
      } catch {
        /* try next secret or RS256 */
      }
    }
    if (mode === "hs256") return null;
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
