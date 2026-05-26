import { createPrivateKey, createPublicKey } from "crypto";
import type { ConfigService } from "@nestjs/config";

export type JwtSigningMode = "hs256" | "rs256" | "dual";

export function resolveJwtSigningMode(config: ConfigService): JwtSigningMode {
  const raw = (config.get<string>("ERA_JWT_SIGNING_MODE") ?? "hs256")
    .trim()
    .toLowerCase();
  if (raw === "rs256" || raw === "dual") return raw;
  return "hs256";
}

export function parseRs256Jwk(config: ConfigService): Record<string, unknown> | null {
  const raw = config.get<string>("ERA_JWT_RS256_JWK")?.trim();
  if (!raw) return null;
  try {
    const key = JSON.parse(raw) as Record<string, unknown>;
    return key.kty && key.kid ? key : null;
  } catch {
    return null;
  }
}

export function jwksPublicKeys(config: ConfigService): { keys: Record<string, unknown>[] } {
  const jwk = parseRs256Jwk(config);
  if (!jwk) {
    return {
      keys: [],
    };
  }
  const pub = publicJwkFromPrivate(jwk);
  return { keys: pub ? [pub] : [] };
}

function publicJwkFromPrivate(jwk: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const keyObject = createPrivateKey({ key: jwk, format: "jwk" });
    const pub = createPublicKey(keyObject).export({ format: "jwk" }) as Record<
      string,
      unknown
    >;
    return { ...pub, kid: jwk.kid, use: "sig", alg: "RS256" };
  } catch {
    return null;
  }
}

export function accessTokenSignOptions(config: ConfigService): {
  algorithm: "HS256" | "RS256";
  secret?: string;
  privateKey?: ReturnType<typeof createPrivateKey>;
  keyid?: string;
} {
  const mode = resolveJwtSigningMode(config);
  const jwk = parseRs256Jwk(config);
  if ((mode === "rs256" || mode === "dual") && jwk) {
    return {
      algorithm: "RS256",
      privateKey: createPrivateKey({ key: jwk, format: "jwk" }),
      keyid: String(jwk.kid),
    };
  }
  const secret =
    config.get<string>("ERA_JWT_SECRET") ??
    config.get<string>("JWT_SECRET") ??
    "";
  return { algorithm: "HS256", secret };
}
