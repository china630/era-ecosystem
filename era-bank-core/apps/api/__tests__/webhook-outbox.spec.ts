import { signWebhookPayload } from "../src/modules/webhooks/webhook-signature.util";

/** Keep in sync with OUTBOX_BACKOFF_SEC in webhooks.service.ts */
const OUTBOX_BACKOFF_SEC = [0, 30, 120, 600];

describe("webhook outbox lab helpers", () => {
  it("exposes backoff ladder for durable retries", () => {
    expect(OUTBOX_BACKOFF_SEC[0]).toBe(0);
    expect(OUTBOX_BACKOFF_SEC.length).toBeGreaterThanOrEqual(3);
    expect(OUTBOX_BACKOFF_SEC[OUTBOX_BACKOFF_SEC.length - 1]).toBeGreaterThan(
      OUTBOX_BACKOFF_SEC[1],
    );
  });

  it("HMAC signature is stable for same secret+body", () => {
    const body = JSON.stringify({
      type: "loan.disbursed",
      payload: { id: "1" },
    });
    const a = signWebhookPayload("secret-lab", body);
    const b = signWebhookPayload("secret-lab", body);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
