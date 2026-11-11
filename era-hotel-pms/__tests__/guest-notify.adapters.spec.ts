import {
  dispatchGuestNotify,
  GUEST_AUTH_CHANNEL_ORDER,
} from "@/lib/services/guest-notify.adapters";

describe("guest-notify adapters", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("prefers SMS then WhatsApp then email", () => {
    expect(GUEST_AUTH_CHANNEL_ORDER).toEqual(["SMS", "WHATSAPP", "EMAIL"]);
  });

  it("marks SMS as stub without Twilio creds", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    const r = await dispatchGuestNotify({
      organizationId: "org1",
      channel: "SMS",
      destination: "+994501112233",
      code: "123456",
    });
    expect(r.stub).toBe(true);
    expect(r.delivered).toBe(false);
  });

  it("marks WhatsApp as stub without Meta/hotel token", async () => {
    delete process.env.META_WA_TOKEN;
    delete process.env.HOTEL_WHATSAPP_TOKEN;
    const r = await dispatchGuestNotify({
      organizationId: "org1",
      channel: "WHATSAPP",
      destination: "+994501112233",
      code: "123456",
    });
    expect(r.stub).toBe(true);
  });

  it("email adapter is non-stub path (live-ready) even without SMTP", async () => {
    delete process.env.GUEST_APP_SMTP_URL;
    delete process.env.SMTP_URL;
    const r = await dispatchGuestNotify({
      organizationId: "org1",
      channel: "EMAIL",
      destination: "guest@example.com",
      code: "123456",
    });
    expect(r.stub).toBe(false);
    expect(r.provider).toBe("email-pending");
  });
});
