import type {
  OrganizationAddressDto,
  OrganizationContactChannelDto,
  OrganizationProfileSnapshot,
  OrgContactKind,
} from "@era/contracts";

export type PrintLang = "az" | "ru" | "en";

export type OutletContactOverlay = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
};

function primaryContact(
  contacts: OrganizationContactChannelDto[],
  kind: OrgContactKind,
): string {
  const list = contacts.filter((c) => c.kind === kind);
  const primary = list.find((c) => c.isPrimary) ?? list[0];
  return primary?.value?.trim() ?? "";
}

function addressLine(
  addr: OrganizationAddressDto | undefined,
  lang: PrintLang = "en",
): string {
  if (!addr) return "";
  const i18n =
    lang === "az"
      ? addr.lineAz
      : lang === "ru"
        ? addr.lineRu
        : addr.lineEn;
  if (i18n?.trim()) return i18n.trim();
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.region,
    addr.postalCode,
    addr.country && addr.country !== "AZ" ? addr.country : null,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

function primaryLegalAddress(
  addresses: OrganizationAddressDto[],
  lang: PrintLang = "en",
): string {
  const legal = addresses.filter((a) => a.kind === "LEGAL");
  const primary = legal.find((a) => a.isPrimary) ?? legal[0] ?? addresses.find((a) => a.isPrimary) ?? addresses[0];
  return addressLine(primary, lang);
}

/** Flat org.* keys for PrintSnapshot / letterhead. */
export function projectOrgPrintKeys(
  snapshot: Pick<
    OrganizationProfileSnapshot,
    | "legalName"
    | "tradeName"
    | "taxId"
    | "logoUrl"
    | "bankLine"
    | "contacts"
    | "addresses"
    | "print"
  >,
  lang: PrintLang = "en",
): OrganizationProfileSnapshot["print"] {
  const contacts = snapshot.contacts ?? [];
  const addresses = snapshot.addresses ?? [];
  const derived = {
    "org.name": (snapshot.tradeName || snapshot.legalName || "").trim(),
    "org.taxId": (snapshot.taxId ?? "").trim(),
    "org.legalAddress": primaryLegalAddress(addresses, lang),
    "org.logoUrl": (snapshot.logoUrl ?? "").trim(),
    "org.bankLine": (snapshot.bankLine ?? "").trim(),
    "org.phone":
      primaryContact(contacts, "PHONE") ||
      primaryContact(contacts, "MOBILE"),
    "org.email": primaryContact(contacts, "EMAIL"),
    "org.website": primaryContact(contacts, "WEBSITE"),
  };
  // Prefer live contacts/addresses; fall back to precomputed print for sparse snapshots.
  if (contacts.length === 0 && addresses.length === 0 && snapshot.print) {
    return {
      ...snapshot.print,
      "org.name": derived["org.name"] || snapshot.print["org.name"],
      "org.taxId": derived["org.taxId"] || snapshot.print["org.taxId"],
      "org.logoUrl": derived["org.logoUrl"] || snapshot.print["org.logoUrl"],
      "org.bankLine": derived["org.bankLine"] || snapshot.print["org.bankLine"],
    };
  }
  return derived;
}

/**
 * Resolve print contacts: org snapshot first, then optional outlet overlay
 * for outlet-scoped docs (same VÖEN, many POS).
 */
export function resolvePrintContacts(args: {
  org: OrganizationProfileSnapshot | null | undefined;
  outlet?: OutletContactOverlay | null;
  lang?: PrintLang;
}): {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  logoUrl: string;
  taxId: string;
  bankLine: string;
} {
  const lang = args.lang ?? "en";
  const keys = args.org
    ? projectOrgPrintKeys(args.org, lang)
    : {
        "org.name": "",
        "org.taxId": "",
        "org.legalAddress": "",
        "org.logoUrl": "",
        "org.bankLine": "",
        "org.phone": "",
        "org.email": "",
        "org.website": "",
      };
  const o = args.outlet;
  return {
    name: (o?.name?.trim() || keys["org.name"]).trim(),
    phone: (o?.phone?.trim() || keys["org.phone"]).trim(),
    email: (o?.email?.trim() || keys["org.email"]).trim(),
    website: (o?.website?.trim() || keys["org.website"]).trim(),
    address: (o?.address?.trim() || keys["org.legalAddress"]).trim(),
    logoUrl: keys["org.logoUrl"],
    taxId: keys["org.taxId"],
    bankLine: keys["org.bankLine"],
  };
}

/** Read cached orgProfile from runtime-config memory if present. */
export function orgProfileFromRuntimeConfig(
  cfg: { orgProfile?: unknown } | null | undefined,
): OrganizationProfileSnapshot | null {
  const raw = cfg?.orgProfile;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as OrganizationProfileSnapshot;
  if (typeof o.organizationId !== "string" || typeof o.legalName !== "string") {
    return null;
  }
  return o;
}
