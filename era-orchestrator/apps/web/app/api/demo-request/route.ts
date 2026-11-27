import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type DemoBody = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  industry?: string;
  message?: string;
  source?: string;
  website?: string; // honeypot
  startedAt?: number;
};

const RATE = new Map<string, { count: number; resetAt: number }>();

function rateOk(ip: string): boolean {
  const now = Date.now();
  const row = RATE.get(ip);
  if (!row || row.resetAt <= now) {
    RATE.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (row.count >= 8) return false;
  row.count += 1;
  return true;
}

async function readSiteConfig(): Promise<{
  publicId: string;
  secret: string;
  crmBase: string;
}> {
  const api = (
    process.env.ORCH_API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_ORCH_API_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");

  // Prefer direct DB via internal admin is not available anonymously.
  // Site config is seeded into system_config; public demo uses a dedicated
  // internal bootstrap endpoint pattern — fall back to env bridge only if set
  // during local seed. Production path: Next server reads via orch API public
  // bootstrap keys mirrored at deploy, OR via system_config through a tiny
  // server-only helper hitting Prisma when co-located.
  //
  // For this wave: call orch API health-adjacent public config if present;
  // otherwise read from process-local bridge written by seed.
  const publicId =
    process.env.SITE_DEMO_FORM_PUBLIC_ID?.trim() ||
    (await fetchConfigKey(api, "site.demo_form_public_id"));
  const secret =
    process.env.SITE_DEMO_FORM_WEBHOOK_SECRET?.trim() ||
    (await fetchConfigKey(api, "site.demo_form_webhook_secret"));
  const crmBase =
    process.env.SITE_CRM_INTERNAL_URL?.trim() ||
    (await fetchConfigKey(api, "site.crm_internal_url")) ||
    (await fetchConfigKey(api, "site.crm_origin")) ||
    "http://127.0.0.1:3207";

  if (!publicId || !secret) {
    throw new Error("Demo form is not configured");
  }
  return { publicId, secret, crmBase: crmBase.replace(/\/$/, "") };
}

async function fetchConfigKey(api: string, key: string): Promise<string> {
  // Server-only internal read — uses service token when present.
  const token =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN ||
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN ||
    "";
  try {
    const res = await fetch(
      `${api}/v1/internal/site-config/${encodeURIComponent(key)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      },
    );
    if (!res.ok) return "";
    const body = (await res.json()) as { value?: unknown };
    return typeof body.value === "string" ? body.value : "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!rateOk(ip)) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }

    const origin = req.headers.get("origin") || "";
    const host = req.headers.get("host") || "";
    if (
      origin &&
      !origin.includes("era-365.online") &&
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1")
    ) {
      return NextResponse.json({ error: "bad_origin" }, { status: 403 });
    }
    if (
      host &&
      !host.includes("era-365.online") &&
      !host.includes("localhost") &&
      !host.includes("127.0.0.1")
    ) {
      return NextResponse.json({ error: "bad_host" }, { status: 403 });
    }

    const body = (await req.json()) as DemoBody;
    if (body.website) {
      return NextResponse.json({ ok: true }); // honeypot
    }
    const startedAt = Number(body.startedAt || 0);
    if (startedAt && Date.now() - startedAt < 2500) {
      return NextResponse.json({ error: "too_fast" }, { status: 400 });
    }
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    if (!name || (!phone && !email)) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }

    const { publicId, secret, crmBase } = await readSiteConfig();
    const payload = {
      name,
      phone,
      email,
      company: String(body.company || "").trim(),
      industry: String(body.industry || "").trim(),
      message: String(body.message || "").trim(),
      source: String(body.source || "era_public_site_demo"),
      utm_source: "era-365.online",
      utm_medium: "demo_form",
    };

    const crmRes = await fetch(
      `${crmBase}/api/integrations/hooks/form_generic/${publicId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!crmRes.ok) {
      const text = await crmRes.text().catch(() => "");
      return NextResponse.json(
        { error: "crm_rejected", detail: text.slice(0, 200) },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error: "server",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
