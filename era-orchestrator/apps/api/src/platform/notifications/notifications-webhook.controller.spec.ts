import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { NotificationsWebhookController } from "./notifications-webhook.controller";

describe("NotificationsWebhookController signature", () => {
  const dispatch = { applyProviderWebhook: jest.fn() };
  const controller = new NotificationsWebhookController(dispatch as never);

  afterEach(() => {
    delete process.env.NOTIFICATIONS_WEBHOOK_SECRET;
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  it("rejects missing signature when secret configured", async () => {
    process.env.NOTIFICATIONS_WEBHOOK_SECRET = "test-secret";
    const body = { outboxId: "o1", status: "SENT" };
    const rawBody = Buffer.from(JSON.stringify(body));
    await expect(
      controller.receive(
        "whatsapp",
        body,
        {},
        { rawBody, query: {}, body } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts valid X-Hub-Signature-256", async () => {
    process.env.NOTIFICATIONS_WEBHOOK_SECRET = "test-secret";
    const body = { outboxId: "o1", status: "SENT" };
    const rawBody = Buffer.from(JSON.stringify(body));
    const sig =
      "sha256=" +
      createHmac("sha256", "test-secret").update(rawBody).digest("hex");
    const result = await controller.receive(
      "whatsapp",
      body,
      { "x-hub-signature-256": sig },
      { rawBody, query: {}, body } as never,
    );
    expect(result).toEqual({ ok: true });
    expect(dispatch.applyProviderWebhook).toHaveBeenCalled();
  });

  it("rejects ?k= token in production when secret configured", async () => {
    process.env.NOTIFICATIONS_WEBHOOK_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    const body = { outboxId: "o1", status: "SENT" };
    const rawBody = Buffer.from(JSON.stringify(body));
    await expect(
      controller.receive(
        "whatsapp",
        body,
        {},
        { rawBody, query: { k: "test-secret" }, body } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
