import { createHmac } from "crypto";
import { verifyHs256JwtPayload } from "../src/auth/bank-auth.guard";

function signHs256(payload: object, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

describe("verifyHs256JwtPayload", () => {
  const secret = "test-jwt-secret-min-32-chars-xxxxxx";

  it("accepts a valid HS256 signature", () => {
    const token = signHs256(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      secret,
    );
    const payload = verifyHs256JwtPayload(token, secret, { nodeEnv: "production" });
    expect(payload?.sub).toBe("user-1");
  });

  it("rejects bad signature in production", () => {
    const token = signHs256(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      secret,
    );
    const [h, b] = token.split(".");
    const tampered = `${h}.${b}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(
      verifyHs256JwtPayload(tampered, secret, { nodeEnv: "production" }),
    ).toBeNull();
  });

  it("rejects expired token even with valid signature", () => {
    const token = signHs256(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 },
      secret,
    );
    expect(
      verifyHs256JwtPayload(token, secret, { nodeEnv: "development" }),
    ).toBeNull();
  });

  it("rejects bad signature in non-prod without explicit insecure skip", () => {
    const token = signHs256(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      secret,
    );
    const [h, b] = token.split(".");
    const tampered = `${h}.${b}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(
      verifyHs256JwtPayload(tampered, secret, {
        nodeEnv: "development",
        allowInsecureDevSkip: false,
      }),
    ).toBeNull();
  });

  it("never skips HMAC when secret is a known placeholder", () => {
    const placeholder = "change-me-shared-hs256-secret-min-32-chars";
    const token = signHs256(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "other-secret-min-32-chars-xxxxxxxx",
    );
    expect(
      verifyHs256JwtPayload(token, placeholder, {
        nodeEnv: "development",
        allowInsecureDevSkip: true,
      }),
    ).toBeNull();
  });

  it("allows insecure decode only with explicit non-prod flag and non-placeholder secret", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    );
    const body = Buffer.from(
      JSON.stringify({ sub: "dev-user", exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    const unsigned = `${header}.${body}.not-a-real-signature`;
    const payload = verifyHs256JwtPayload(unsigned, secret, {
      nodeEnv: "development",
      allowInsecureDevSkip: true,
    });
    expect(payload?.sub).toBe("dev-user");
  });
});
