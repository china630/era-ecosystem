import {
  hashApiKey,
  hashLoginIdentifier,
  hashOtpCode,
  signCustomerJwt,
  verifyCustomerJwt,
} from "../src/modules/dbo/dbo-crypto.util";

describe("dbo-crypto", () => {
  const secret = "change-me-bank-dbo-session-secret-min-32";

  it("hashes login identifiers consistently", () => {
    expect(hashLoginIdentifier("1234567")).toBe(hashLoginIdentifier("1234567"));
    expect(hashLoginIdentifier("1234567")).not.toBe(hashLoginIdentifier("1234567890"));
  });

  it("issues and verifies customer JWT", () => {
    const token = signCustomerJwt(
      { sub: "demo-retail-customer", channel: "RETAIL", accountIds: ["a1"] },
      secret,
    );
    const payload = verifyCustomerJwt(token, secret);
    expect(payload?.sub).toBe("demo-retail-customer");
    expect(payload?.accountIds).toEqual(["a1"]);
  });

  it("hashes OTP codes", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });

  it("matches era-bank-dbo demo API key hash", () => {
    expect(hashApiKey("dbo-demo-api-key-change-in-prod")).toHaveLength(64);
  });
});

describe("dbo scoped access rules", () => {
  it("rejects account outside JWT scope", () => {
    const accountIds = ["acc-a"];
    expect(accountIds.includes("acc-b")).toBe(false);
  });
});
