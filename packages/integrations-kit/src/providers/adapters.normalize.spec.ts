import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAdapter } from "../registry";

const fixtures = join(__dirname, "__fixtures__");

describe("provider normalize fixtures", () => {
  it("telegram_bot normalizes message.in", async () => {
    const adapter = getAdapter("telegram_bot");
    expect(adapter).toBeTruthy();
    const raw = readFileSync(join(fixtures, "telegram_message.json"));
    const events = await adapter!.normalize!(
      {
        method: "POST",
        headers: {},
        rawBody: raw,
        query: {},
      },
      {
        connectionId: "c1",
        organizationId: "o1",
        config: {},
        secrets: {},
        webhookUrl: "",
        webhookSecret: "sec",
        http: { request: async () => ({ status: 200, json: null, text: "" }) },
        log: console,
      },
    );
    expect(events[0]?.kind).toBe("message.in");
    if (events[0]?.kind === "message.in") {
      expect(events[0].chatId).toBe("555001");
      expect(events[0].message.text).toBe("Hello from fixture");
    }
  });

  it("whatsapp_cloud normalizes inbound text", async () => {
    const adapter = getAdapter("whatsapp_cloud");
    const raw = readFileSync(join(fixtures, "whatsapp_message.json"));
    const events = await adapter!.normalize!(
      {
        method: "POST",
        headers: {},
        rawBody: raw,
        query: {},
      },
      {
        connectionId: "c1",
        organizationId: "o1",
        config: {},
        secrets: { appSecret: "x" },
        webhookUrl: "",
        webhookSecret: "",
        http: { request: async () => ({ status: 200, json: null, text: "" }) },
        log: console,
      },
    );
    expect(events.some((e) => e.kind === "message.in")).toBe(true);
  });

  it("viber_bot normalizes message.in", async () => {
    const adapter = getAdapter("viber_bot");
    const raw = readFileSync(join(fixtures, "viber_message.json"));
    const events = await adapter!.normalize!(
      { method: "POST", headers: {}, rawBody: raw, query: {} },
      {
        connectionId: "c1",
        organizationId: "o1",
        config: { senderName: "ERA" },
        secrets: { authToken: "tok" },
        webhookUrl: "",
        webhookSecret: "",
        http: { request: async () => ({ status: 200, json: null, text: "" }) },
        log: console,
      },
    );
    expect(events[0]?.kind).toBe("message.in");
    if (events[0]?.kind === "message.in") {
      expect(events[0].chatId).toBe("viber-user-1");
      expect(events[0].message.text).toBe("Hello from Viber fixture");
    }
  });

  it("vk_community normalizes message_new", async () => {
    const adapter = getAdapter("vk_community");
    const raw = readFileSync(join(fixtures, "vk_message_new.json"));
    const events = await adapter!.normalize!(
      { method: "POST", headers: {}, rawBody: raw, query: {} },
      {
        connectionId: "c1",
        organizationId: "o1",
        config: { confirmationCode: "ok" },
        secrets: { secretKey: "vk-secret", accessToken: "t" },
        webhookUrl: "",
        webhookSecret: "",
        http: { request: async () => ({ status: 200, json: null, text: "" }) },
        log: console,
      },
    );
    expect(events[0]?.kind).toBe("message.in");
    if (events[0]?.kind === "message.in") {
      expect(events[0].chatId).toBe("2000001");
    }
  });

  it("wazzup normalizes message.in", async () => {
    const adapter = getAdapter("wazzup");
    const raw = readFileSync(join(fixtures, "wazzup_message.json"));
    const events = await adapter!.normalize!(
      { method: "POST", headers: {}, rawBody: raw, query: {} },
      {
        connectionId: "c1",
        organizationId: "o1",
        config: {},
        secrets: { apiKey: "k" },
        webhookUrl: "",
        webhookSecret: "",
        http: { request: async () => ({ status: 200, json: null, text: "" }) },
        log: console,
      },
    );
    expect(events[0]?.kind).toBe("message.in");
    if (events[0]?.kind === "message.in") {
      expect(events[0].chatId).toBe("994501112233");
    }
  });

  it("megafon_vats normalizes INCOMING as call.ringing", async () => {
    const adapter = getAdapter("megafon_vats");
    const raw = readFileSync(join(fixtures, "megafon_event.json"));
    const events = await adapter!.normalize!(
      { method: "POST", headers: {}, rawBody: raw, query: {} },
      {
        connectionId: "c1",
        organizationId: "o1",
        config: { apiUrl: "https://example.invalid/sys/crm_api.wcgp" },
        secrets: { crmToken: "crm-token", apiKey: "k" },
        webhookUrl: "",
        webhookSecret: "",
        http: { request: async () => ({ status: 200, json: null, text: "" }) },
        log: console,
      },
    );
    expect(events[0]?.kind).toBe("call.ringing");
  });

  it("catalog adapters do not stub-ping success without implementation", async () => {
    const adapter = getAdapter("sms_generic");
    const result = await adapter!.testConnection({
      connectionId: "c1",
      organizationId: "o1",
      config: {},
      secrets: { apiKey: "x" },
      webhookUrl: "",
      webhookSecret: "s",
      http: { request: async () => ({ status: 200, json: null, text: "" }) },
      log: console,
    });
    expect(result.message).not.toMatch(/stub ping/i);
  });
});
