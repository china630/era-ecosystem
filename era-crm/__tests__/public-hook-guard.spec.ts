import {
  _resetPublicHookGuardForTests,
  assertPublicRateLimit,
  hookGuardSecret,
  issueMathChallenge,
  verifyMathChallenge,
} from "@/lib/integrations/public-hook-guard";

describe("public-hook-guard", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevKek = process.env.CRM_INTEGRATIONS_KEK;
  const prevJwt = process.env.JWT_SECRET;

  beforeEach(() => {
    _resetPublicHookGuardForTests();
    process.env.CRM_INTEGRATIONS_KEK = "test-kek-for-captcha-hmac";
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevKek === undefined) delete process.env.CRM_INTEGRATIONS_KEK;
    else process.env.CRM_INTEGRATIONS_KEK = prevKek;
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
  });

  it("issues and verifies math captcha once (replay fails)", () => {
    const ch = issueMathChallenge();
    expect(verifyMathChallenge(ch.token, ch.a + ch.b)).toBe(true);
    expect(verifyMathChallenge(ch.token, ch.a + ch.b)).toBe(false);
    expect(verifyMathChallenge(ch.token, ch.a + ch.b + 1)).toBe(false);
    expect(verifyMathChallenge("bad", 1)).toBe(false);
  });

  it("rate-limits after threshold", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      expect(assertPublicRateLimit(key, 20, 60_000).ok).toBe(true);
    }
    expect(assertPublicRateLimit(key, 20, 60_000).ok).toBe(false);
  });

  it("fail-closes secret() in production without KEK", () => {
    delete process.env.CRM_INTEGRATIONS_KEK;
    process.env.NODE_ENV = "production";
    expect(() => hookGuardSecret()).toThrow(/CRM_INTEGRATIONS_KEK/);
  });
});
