describe("pii-crypto resolveKey fail-closed", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevPii = process.env.ERA_PII_ENCRYPTION_KEY;
  const prevJwt = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    if (prevPii === undefined) delete process.env.ERA_PII_ENCRYPTION_KEY;
    else process.env.ERA_PII_ENCRYPTION_KEY = prevPii;
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
    jest.resetModules();
  });

  it("throws in production when primary key missing", async () => {
    delete process.env.ERA_PII_ENCRYPTION_KEY;
    process.env.JWT_SECRET = "should-not-be-used";
    process.env.NODE_ENV = "production";
    await expect(async () => {
      const mod = await import("./pii-crypto.util");
      mod.encryptText("x");
    }).rejects.toThrow(/required in production/);
  });
});
