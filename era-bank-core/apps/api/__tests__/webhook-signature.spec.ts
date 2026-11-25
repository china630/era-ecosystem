import {
  signWebhookPayload,
  verifyWebhookPayload,
} from "../src/modules/webhooks/webhook-signature.util";

describe("webhook HMAC signature", () => {
  const secret = "test-webhook-secret";
  const body = JSON.stringify({ type: "payment.settled", id: "pay_1" });

  it("produces a stable sha256 hex digest", () => {
    const a = signWebhookPayload(secret, body);
    const b = signWebhookPayload(secret, body);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies matching signatures and rejects tampered bodies", () => {
    const sig = signWebhookPayload(secret, body);
    expect(verifyWebhookPayload(secret, body, sig)).toBe(true);
    expect(
      verifyWebhookPayload(secret, body + " ", signWebhookPayload(secret, body + " ")),
    ).toBe(true);
    expect(verifyWebhookPayload(secret, body + "x", sig)).toBe(false);
  });
});