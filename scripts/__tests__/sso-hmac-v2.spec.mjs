/**
 * Negative/positive checks for SEC-SSO-02 (financeRole in HMAC).
 * Mirrors packages/satellite-kit/src/auth/sso-verify.ts
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const SECRET = "unit-test-sso-secret";

function buildSsoPayload(email, organizationId, expiresAt, financeRole) {
  const base = `${email}|${organizationId}|${expiresAt}`;
  const role = financeRole?.trim();
  if (role) return `${base}|${role}`;
  return base;
}

function verify(payload, signature) {
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function resolveVerifiedSsoFinanceRole(input) {
  const claimed = input.financeRole?.trim() || "";
  if (claimed) {
    const v2 = buildSsoPayload(input.email, input.organizationId, input.expiresAt, claimed);
    if (verify(v2, input.signature)) return claimed;
  }
  const v1 = buildSsoPayload(input.email, input.organizationId, input.expiresAt);
  if (verify(v1, input.signature)) return "USER";
  return null;
}

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

describe("SSO HMAC v2 financeRole", () => {
  it("accepts signed OWNER role", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = sign(buildSsoPayload("a@b.c", "org1", exp, "OWNER"));
    const role = resolveVerifiedSsoFinanceRole({
      email: "a@b.c",
      organizationId: "org1",
      expiresAt: exp,
      signature: sig,
      financeRole: "OWNER",
    });
    assert.equal(role, "OWNER");
  });

  it("rejects unsigned OWNER escalation on v1 ticket", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = sign(buildSsoPayload("a@b.c", "org1", exp));
    const role = resolveVerifiedSsoFinanceRole({
      email: "a@b.c",
      organizationId: "org1",
      expiresAt: exp,
      signature: sig,
      financeRole: "OWNER",
    });
    assert.equal(role, "USER");
  });

  it("rejects forged signature", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const role = resolveVerifiedSsoFinanceRole({
      email: "a@b.c",
      organizationId: "org1",
      expiresAt: exp,
      signature: "00".repeat(32),
      financeRole: "OWNER",
    });
    assert.equal(role, null);
  });
});
