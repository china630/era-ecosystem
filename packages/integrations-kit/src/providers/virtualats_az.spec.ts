import { virtualatsAzAdapter, virtualatsSign } from "./virtualats_az";
import type { RawRequest } from "../types";

describe("virtualats_az", () => {
  it("maps HANGUP ANSWER to call.ended", async () => {
    const body = {
      apiKey: "crm-key",
      callId: "c-1",
      state: "HANGUP",
      disposition: "ANSWERED",
      direction: "INBOUND",
      callerId: "+994501234567",
      destination: "100",
      talkTime: 42,
      callDate: "2026-11-25 12:00:00+0400",
    };
    const rawReq = {
      method: "POST",
      headers: {},
      rawBody: Buffer.from(JSON.stringify(body)),
      query: {},
    } satisfies RawRequest;
    const events = await virtualatsAzAdapter.normalize?.(rawReq, {
      connectionId: "c",
      organizationId: "o",
      config: {},
      secrets: { apiKey: "crm-key" },
      webhookUrl: "",
      webhookSecret: "",
      http: { request: async () => ({ status: 200, json: {}, text: "" }) },
      log: console,
    });
    expect(events?.[0]?.kind).toBe("call.ended");
    if (events?.[0]?.kind === "call.ended") {
      expect(events[0].call.durationSec).toBe(42);
    }
  });

  it("sign helper returns vats-authentication triple", () => {
    const { header } = virtualatsSign("pub", "sec", "payload");
    expect(header.split(":")).toHaveLength(3);
  });
});