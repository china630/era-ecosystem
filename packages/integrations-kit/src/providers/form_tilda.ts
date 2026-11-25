import { formGenericAdapter } from "./form_generic";
import type { BaseAdapter, NormalizedEvent, RawRequest } from "../types";

async function normalizeTilda(req: RawRequest): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  // Tilda often posts form fields at top level or under data.
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" || typeof v === "number") fields[k] = String(v);
  }
  return [
    {
      kind: "lead.captured",
      at: new Date().toISOString(),
      source: "form_tilda",
      fields,
      contact: {
        phone: fields.phone || fields.Phone || fields.tel,
        email: fields.email || fields.Email,
        name: fields.name || fields.Name || fields.fullname,
      },
      utm: {
        utm_source: fields.utm_source ?? "",
        utm_medium: fields.utm_medium ?? "",
        utm_campaign: fields.utm_campaign ?? "",
      },
    },
  ];
}

export const formTildaAdapter: BaseAdapter = {
  ...formGenericAdapter,
  manifest: {
    ...formGenericAdapter.manifest,
    key: "form_tilda",
    name: "Tilda forms",
    docsUrl: "https://help-ru.tilda.cc/forms/webhook",
  },
  normalize: normalizeTilda,
};
