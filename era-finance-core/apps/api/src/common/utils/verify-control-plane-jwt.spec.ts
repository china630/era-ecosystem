import { sign } from "jsonwebtoken";
import type { ConfigService } from "@nestjs/config";
import {
  resetControlPlaneJwksCache,
  resolveControlPlaneJwksUrl,
  verifyControlPlaneAccessToken,
} from "./verify-control-plane-jwt";

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

const claims = {
  sub: "user-1",
  email: "admin@example.com",
  organizationId: "org-1",
  role: "OWNER",
  isSuperAdmin: true,
};

describe("verifyControlPlaneAccessToken", () => {
  beforeEach(() => {
    resetControlPlaneJwksCache();
  });

  it("accepts HS256 tokens signed with ERA_JWT_SECRET", async () => {
    const token = sign(claims, "shared-secret", {
      algorithm: "HS256",
      issuer: "era-orchestrator",
      audience: "era-finance-core",
      expiresIn: "5m",
    });
    const payload = await verifyControlPlaneAccessToken(
      token,
      config({
        ERA_JWT_SECRET: "shared-secret",
        ERA_JWT_VERIFY_MODE: "hs256",
        ERA_JWT_JWKS_URL: "",
      }),
    );
    expect(payload?.email).toBe("admin@example.com");
    expect(payload?.isSuperAdmin).toBe(true);
  });

  it("rejects tokens when secret/audience do not match", async () => {
    const token = sign(claims, "other-secret", {
      algorithm: "HS256",
      issuer: "era-orchestrator",
      audience: "era-finance-core",
      expiresIn: "5m",
    });
    const payload = await verifyControlPlaneAccessToken(
      token,
      config({
        ERA_JWT_SECRET: "shared-secret",
        ERA_JWT_VERIFY_MODE: "hs256",
        ERA_JWT_JWKS_URL: "",
      }),
    );
    expect(payload).toBeNull();
  });

  it("prefers CONTROL_PLANE_URL over loopback ERA_JWT_JWKS_URL", () => {
    expect(
      resolveControlPlaneJwksUrl(
        config({
          ERA_JWT_JWKS_URL: "http://127.0.0.1:4000/.well-known/jwks.json",
          CONTROL_PLANE_URL: "http://orchestrator:4000",
        }),
      ),
    ).toBe("http://orchestrator:4000/.well-known/jwks.json");
  });

  it("does not throw when JWKS host is unreachable", async () => {
    const token = sign(claims, "shared-secret", {
      algorithm: "HS256",
      issuer: "era-orchestrator",
      audience: "wrong-aud",
      expiresIn: "5m",
    });
    const payload = await verifyControlPlaneAccessToken(
      token,
      config({
        ERA_JWT_SECRET: "shared-secret",
        ERA_JWT_VERIFY_MODE: "dual",
        ERA_JWT_JWKS_URL: "http://127.0.0.1:9/.well-known/jwks.json",
      }),
    );
    expect(payload).toBeNull();
  });
});
