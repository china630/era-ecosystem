import {
  decryptSecretsJson,
  encryptSecretsJson,
  maskSecret,
  redactForLog,
} from "./crypto";

describe("integrations-kit crypto", () => {
  const prev = process.env.CRM_INTEGRATIONS_KEK;

  beforeAll(() => {
    process.env.CRM_INTEGRATIONS_KEK = Buffer.alloc(32, 7).toString("base64");
  });

  afterAll(() => {
    if (prev === undefined) delete process.env.CRM_INTEGRATIONS_KEK;
    else process.env.CRM_INTEGRATIONS_KEK = prev;
  });

  it("round-trips secrets JSON", () => {
    const enc = encryptSecretsJson({ botToken: "123:abc" });
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptSecretsJson(enc)).toEqual({ botToken: "123:abc" });
  });

  it("throws without CRM_INTEGRATIONS_KEK", () => {
    const keep = process.env.CRM_INTEGRATIONS_KEK;
    delete process.env.CRM_INTEGRATIONS_KEK;
    expect(() => encryptSecretsJson({ a: "b" })).toThrow(/CRM_INTEGRATIONS_KEK/);
    process.env.CRM_INTEGRATIONS_KEK = keep;
  });

  it("masks and redacts secrets in logs", () => {
    expect(maskSecret("supersecret")).toBe("••••cret");
    expect(redactForLog({ botToken: "abcd1234", ok: true })).toEqual({
      botToken: "••••1234",
      ok: true,
    });
  });
});
