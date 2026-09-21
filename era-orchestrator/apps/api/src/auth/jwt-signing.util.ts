import { createPrivateKey, createPublicKey } from "crypto";
import { readFileSync } from "fs";
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
  const filePath = config.get<string>("ERA_JWT_RS256_JWK_FILE")?.trim();
  if (filePath) {
    try {
      const raw = readFileSync(filePath, "utf8").trim();
      const key = JSON.parse(raw) as Record<string, unknown>;
      return key.kty && key.kid ? key : null;
    } catch {
      return null;
    }
  }
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

function hs256Secret(config: ConfigService): string {
  return (
    config.get<string>("ERA_JWT_SECRET") ??
    config.get<string>("JWT_SECRET") ??
    ""
  );
}

export function jwtHeaderAlg(token: string): string | undefined {
  const header = token.split(".")[0];
  if (!header) return undefined;
  try {
    const json = Buffer.from(header, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { alg?: string };
    return parsed.alg;
  } catch {
    return undefined;
  }
}

export function accessTokenSignOptions(config: ConfigService): {
  algorithm: "HS256" | "RS256";
  /**
   * Pass to NestJS `JwtService.signAsync({ secret })`.
   * `@nestjs/jwt` prefers `options.secret` over `options.privateKey` when the
   * module was registered with an HS256 `secret` — using `privateKey` here
   * signs with the HS256 string under `algorithm: RS256` and throws.
   */
  secret: string | ReturnType<typeof createPrivateKey>;
  privateKey?: ReturnType<typeof createPrivateKey>;
  keyid?: string;
} {
  const mode = resolveJwtSigningMode(config);
  const jwk = parseRs256Jwk(config);
  if ((mode === "rs256" || mode === "dual") && jwk) {
    const privateKey = createPrivateKey({ key: jwk, format: "jwk" });
    return {
      algorithm: "RS256",
      secret: privateKey,
      privateKey,
      keyid: String(jwk.kid),
    };
  }
  return { algorithm: "HS256", secret: hs256Secret(config) };
}

export function accessTokenVerifyOptions(
  config: ConfigService,
  token: string,
): {
  algorithms: ("HS256" | "RS256")[];
  secret: string | ReturnType<typeof createPublicKey>;
} {
  const mode = resolveJwtSigningMode(config);
  const jwk = parseRs256Jwk(config);
  const alg = jwtHeaderAlg(token);
  if (alg === "RS256" && (mode === "rs256" || mode === "dual") && jwk) {
    const priv = createPrivateKey({ key: jwk, format: "jwk" });
    return { algorithms: ["RS256"], secret: createPublicKey(priv) };
  }
  return { algorithms: ["HS256"], secret: hs256Secret(config) };
}
