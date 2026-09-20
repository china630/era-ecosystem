import type { ConfigService } from "@nestjs/config";
import {
  accessTokenSignOptions,
  accessTokenVerifyOptions,
  jwtHeaderAlg,
  resolveJwtSigningMode,
} from "./jwt-signing.util";

function cfg(map: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => map[key],
  } as ConfigService;
}

describe("jwt-signing.util", () => {
  it("defaults signing mode to hs256", () => {
    expect(resolveJwtSigningMode(cfg({}))).toBe("hs256");
    expect(resolveJwtSigningMode(cfg({ ERA_JWT_SIGNING_MODE: "dual" }))).toBe(
      "dual",
    );
  });

  it("falls back to HS256 in dual mode when no JWK is configured", () => {
    const sign = accessTokenSignOptions(
      cfg({
        ERA_JWT_SIGNING_MODE: "dual",
        ERA_JWT_SECRET: "unit-test-hs256-secret-min-32-chars!!",
      }),
    );
    expect(sign.algorithm).toBe("HS256");
    expect(sign.secret).toBe("unit-test-hs256-secret-min-32-chars!!");
  });

  it("parses JWT header alg without verifying the signature", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    expect(jwtHeaderAlg(`${header}.e30.sig`)).toBe("RS256");
  });

  it("verify options use HS256 for HS256 tokens even in dual mode", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const token = `${header}.e30.sig`;
    const verify = accessTokenVerifyOptions(
      cfg({
        ERA_JWT_SIGNING_MODE: "dual",
        ERA_JWT_SECRET: "unit-test-hs256-secret-min-32-chars!!",
      }),
      token,
    );
    expect(verify.algorithms).toEqual(["HS256"]);
    expect(verify.secret).toBe("unit-test-hs256-secret-min-32-chars!!");
  });
});
