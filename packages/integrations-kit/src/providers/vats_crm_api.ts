/**
 * Shared Megafon/Gravitel/MTS VATS CRM API family (F3 / T-I25).
 * Events: cmd=event|history|contact; originate: cmd=makeCall.
 */
import {
  catalogAdapter,
  eventAt,
  parseJsonOrForm,
  secretField,
  stringField,
} from "./_factory";
import { safeEqual } from "../crypto";
import type {
  AdapterContext,
  AdapterHttpResponse,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

function buildVatsAdapter(
  key: string,
  name: string,
  docsUrl: string,
  verified: "V" | "C" | "U",
): TelephonyAdapter {
  const manifest: ProviderManifest = {
    key,
    name,
    category: "TELEPHONY",
    family: "vats_crm_api",
    regions: ["CIS"],
    tier: "P1",
    docsUrl,
    verified,
    auth: "api_key",
    fields: [
      secretField("crmToken", {
        ru: "CRM token (АТС → CRM)",
        az: "CRM token",
        en: "CRM token (PBX → CRM)",
      }),
      stringField("apiUrl", {
        ru: "API URL (…/crm_api.wcgp)",
        az: "API URL",
        en: "API URL (…/crm_api.wcgp)",
      }, true),
      secretField("apiKey", {
        ru: "API key (CRM → АТС)",
        az: "API key",
        en: "API key (CRM → PBX)",
      }),
    ],
    inbound: {
      mode: "webhook",
      events: ["event", "history", "contact"],
      verify: "crmToken field",
    },
    outbound: ["originateCall"],
    capabilities: { media: false },
    rateLimit: { perSecond: 10 },
    setupSteps: {
      ru: ["crmToken в АТС", "apiUrl + apiKey", "Webhook URL CRM hooks"],
      en: ["crmToken in PBX", "apiUrl + apiKey", "Webhook URL CRM hooks"],
      az: ["crmToken PBX", "apiUrl + apiKey", "CRM hooks URL"],
    },
    autoRegisterWebhook: false,
  };

  return {
    ...catalogAdapter(manifest, {
      async testConnection(ctx): Promise<TestResult> {
        const apiUrl = String(ctx.config.apiUrl ?? "");
        const apiKey = String(ctx.secrets.apiKey ?? "");
        if (!apiUrl || !apiKey) return { ok: false, message: "apiUrl and apiKey required" };
        return { ok: true, message: `${name}: credentials present (live ping = makeCall dry-run skipped)` };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
        const expected = String(ctx.secrets.crmToken ?? ctx.webhookSecret ?? "");
        const got = String(body.crm_token ?? body.crmToken ?? body.token ?? "");
        if (!expected) return { ok: false, reason: "missing crmToken" };
        return safeEqual(got, expected)
          ? { ok: true }
          : { ok: false, reason: "crmToken mismatch" };
      },
      respond(_events, req, ctx): AdapterHttpResponse {
        const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
        const cmd = String(body.cmd ?? "").toLowerCase();
        if (cmd === "contact") {
          const contactName = String(ctx.config.contactName ?? "CRM contact");
          const responsible = String(ctx.config.responsibleUserId ?? "");
          return {
            status: 200,
            body: JSON.stringify({ contact_name: contactName, responsible }),
            contentType: "application/json",
          };
        }
        return { status: 200, body: "ok" };
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
        const cmd = String(body.cmd ?? body.command ?? "event").toLowerCase();
        if (cmd === "contact") return [];
        const callId = String(
          body.callid ?? body.call_id ?? body.CallID ?? body.linkedid ?? body.session_id ?? "",
        );
        if (!callId) return [];
        const phone = String(body.phone ?? body.caller ?? body.from ?? body.telnum ?? "");
        const ext = String(body.user ?? body.ext ?? body.extension ?? "");
        const eventType = String(body.type ?? body.event ?? "").toUpperCase();
        const direction =
          eventType === "OUTGOING" || String(body.direction ?? body.type ?? "").toLowerCase().startsWith("out")
            ? "OUTBOUND"
            : "INBOUND";
        const at = eventAt(body, ["start"]);

        if (cmd === "history") {
          const status = String(body.status ?? body.disposition ?? "").toUpperCase();
          const success = status === "SUCCESS";
          return [
            {
              kind: success ? "call.ended" : "call.missed",
              at,
              call: {
                externalCallId: callId,
                direction,
                fromNumber: phone || undefined,
                toNumber: ext || undefined,
                extension: ext || undefined,
                durationSec: Number(body.duration ?? body.talk_time ?? 0) || undefined,
                recordingUrl: body.link ? String(body.link) : body.recording
                  ? String(body.recording)
                  : undefined,
              },
            },
          ];
        }

        let kind: NormalizedEvent["kind"] = "call.ringing";
        if (eventType === "INCOMING" || eventType === "OUTGOING") {
          kind = "call.ringing";
        } else if (eventType === "ACCEPTED") {
          kind = "call.answered";
        } else if (eventType === "CANCELLED") {
          kind = "call.missed";
        } else if (eventType === "COMPLETED") {
          kind = "call.ended";
        }
        return [
          {
            kind,
            at,
            call: {
              externalCallId: callId,
              direction,
              fromNumber: phone || undefined,
              toNumber: ext || undefined,
              extension: ext || undefined,
            },
          },
        ];
      },
    }),
    async originateCall(ctx: AdapterContext, p) {
      const apiUrl = String(ctx.config.apiUrl ?? "");
      const apiKey = String(ctx.secrets.apiKey ?? "");
      if (!apiUrl || !apiKey) throw new Error("apiUrl/apiKey required");
      const bodyMode = String(ctx.config.bodyMode ?? "json").toLowerCase();
      const payload = {
        cmd: "makeCall",
        token: apiKey,
        phone: p.to,
        user: p.fromExtension,
      };
      const res = await ctx.http.request({
        method: "POST",
        url: apiUrl,
        headers:
          bodyMode === "form"
            ? { "content-type": "application/x-www-form-urlencoded" }
            : { "content-type": "application/json" },
        body:
          bodyMode === "form"
            ? new URLSearchParams(payload as Record<string, string>).toString()
            : payload,
      });
      if (res.status >= 300) throw new Error(`${name} makeCall failed: ${res.text}`);
      const json = res.json as { CallID?: string; call_id?: string };
      const id = String(json.CallID ?? json.call_id ?? "");
      return { externalCallId: id || `vats-${Date.now()}` };
    },
  };
}

export const megafonVatsAdapter = buildVatsAdapter(
  "megafon_vats",
  "Megafon VATS",
  "https://www.megapbx.ru/elma365_setup",
  "C",
);

export const mtsVatsAdapter = buildVatsAdapter(
  "mts_vats",
  "MTS VATS",
  "https://vpbxdocs.exolve.ru/_media/crm_rest_api.pdf",
  "V",
);
