export type SiteContacts = {
  phone: string;
  phoneE164: string;
  email: string;
  address: string;
  legalName: string;
  voen: string;
};

const FALLBACK: SiteContacts = {
  phone: "+994 77 350 70 70",
  phoneE164: "+994773507070",
  email: "chingiz@era-365.online",
  address: "",
  legalName: "",
  voen: "",
};

async function readKey(api: string, key: string, token: string): Promise<string> {
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

/** Server-only contacts from system_config (fallback = seed defaults). */
export async function fetchSiteContacts(): Promise<SiteContacts> {
  const api = (
    process.env.ORCH_API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_ORCH_API_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
  const token =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN ||
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN ||
    "";

  const [phone, phoneE164, email, address, legalName, voen] = await Promise.all([
    readKey(api, "site.contact_phone", token),
    readKey(api, "site.contact_phone_e164", token),
    readKey(api, "site.contact_email", token),
    readKey(api, "site.contact_address", token),
    readKey(api, "site.legal_name", token),
    readKey(api, "site.voen", token),
  ]);

  return {
    phone: phone || FALLBACK.phone,
    phoneE164: phoneE164 || FALLBACK.phoneE164,
    email: email || FALLBACK.email,
    address,
    legalName,
    voen,
  };
}
