import { buildNotificationIdempotencyKey } from "./notifications-idempotency.util";

describe("notification idempotency key", () => {
  it("is stable for the same org + source + template", () => {
    const a = buildNotificationIdempotencyKey({
      organizationId: "org-1",
      sourceEntityType: "invoice",
      sourceEntityId: "inv-1",
      templateKey: "finance.invoice.email",
    });
    const b = buildNotificationIdempotencyKey({
      organizationId: "org-1",
      sourceEntityType: "invoice",
      sourceEntityId: "inv-1",
      templateKey: "finance.invoice.email",
    });
    expect(a).toBe(b);
  });
});
