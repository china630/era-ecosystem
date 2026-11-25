import { getAdapter, listManifests } from "./registry";

describe("registry", () => {
  it("lists manifests including P0 telegram and whatsapp", () => {
    const keys = listManifests().map((m) => m.key);
    expect(keys).toContain("telegram_bot");
    expect(keys).toContain("whatsapp_cloud");
    expect(keys).toContain("generic_messenger");
    expect(keys).toContain("zadarma");
    expect(keys).toContain("wa_green_api");
    expect(keys).toContain("meta_capi");
    expect(keys).toContain("sms_twilio");
    expect(keys.length).toBeGreaterThan(40);
  });

  it("resolves adapters by key", () => {
    expect(getAdapter("mock_telegram")?.manifest.tier).toBe("P0");
  });

  it("keeps P2 catalog blocked with failing testConnection", async () => {
    const adapter = getAdapter("vonage");
    expect(adapter?.manifest.docsUrl.startsWith("blocked://")).toBe(true);
    const result = await adapter?.testConnection({
      connectionId: "x",
      organizationId: "y",
      config: {},
      secrets: { apiKey: "k" },
      webhookUrl: "",
      webhookSecret: "",
      http: { request: async () => ({ status: 200, json: {}, text: "" }) },
      log: console,
    });
    expect(result?.ok).toBe(false);
  });

  it("registers standalone gravitel adapter", () => {
    expect(getAdapter("gravitel")?.manifest.family).toBe("gravitel_rest");
  });

  it("registers virtualats_az telephony adapter", () => {
    expect(getAdapter("virtualats_az")?.manifest.category).toBe("TELEPHONY");
    expect(getAdapter("sms_lsim")?.manifest.category).toBe("SMS");
  });
});
