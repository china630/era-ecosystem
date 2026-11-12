export const GUEST_APP_LOCALES = ["az", "ru", "en"] as const;
export type GuestAppLocale = (typeof GUEST_APP_LOCALES)[number];

export type GuestAppBrand = {
  organizationId: string;
  enabled: boolean;
  displayName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  locale: GuestAppLocale | null;
  deskPhone: string | null;
  catalogJson: unknown;
  postStayMessage: string | null;
  offersJson: unknown;
  doctorOnDutyPhone: string | null;
  leadAlertMinutes: number | null;
  enabledOrderKinds: unknown;
};

export type GuestAppPatch = {
  enabled: boolean;
  displayName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  locale: GuestAppLocale | null;
  deskPhone: string | null;
  catalogJson?: unknown;
  postStayMessage?: string | null;
  offersJson?: unknown;
  doctorOnDutyPhone?: string | null;
  leadAlertMinutes?: number | null;
  enabledOrderKinds?: unknown;
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function emptyGuestAppBrand(organizationId: string): GuestAppBrand {
  return {
    organizationId,
    enabled: false,
    displayName: null,
    primaryColor: null,
    logoUrl: null,
    locale: null,
    deskPhone: null,
    catalogJson: null,
    postStayMessage: null,
    offersJson: null,
    doctorOnDutyPhone: null,
    leadAlertMinutes: null,
    enabledOrderKinds: null,
  };
}

/**
 * The phone paints only this organization's row.
 * A DEPARTMENT does not inherit a parent hotel's guest-app brand.
 * A disabled row is the same empty brand as a missing row.
 */
function asGuestLocale(value: string | null | undefined): GuestAppLocale | null {
  return value === "az" || value === "ru" || value === "en" ? value : null;
}

export function brandFromRow(
  organizationId: string,
  row: (Omit<GuestAppPatch, "locale"> & { locale: string | null }) | null,
): GuestAppBrand {
  if (!row || !row.enabled) return emptyGuestAppBrand(organizationId);
  return {
    organizationId,
    enabled: true,
    displayName: row.displayName,
    primaryColor: row.primaryColor,
    logoUrl: row.logoUrl,
    locale: asGuestLocale(row.locale),
    deskPhone: row.deskPhone,
    catalogJson: row.catalogJson ?? null,
    postStayMessage: row.postStayMessage ?? null,
    offersJson: row.offersJson ?? null,
    doctorOnDutyPhone: row.doctorOnDutyPhone ?? null,
    leadAlertMinutes: row.leadAlertMinutes ?? null,
    enabledOrderKinds: row.enabledOrderKinds ?? null,
  };
}

function optionalString(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("STRING");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error("TOO_LONG");
  return trimmed;
}

export function parseGuestAppPatch(raw: unknown): GuestAppPatch {
  if (!raw || typeof raw !== "object") throw new Error("BODY");
  const body = raw as Record<string, unknown>;
  if (typeof body.enabled !== "boolean") throw new Error("ENABLED");
  const displayName = optionalString(body.displayName, 80);
  const logoUrl = optionalString(body.logoUrl, 500);
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) throw new Error("LOGO");
  let primaryColor: string | null = null;
  if (body.primaryColor != null && body.primaryColor !== "") {
    if (typeof body.primaryColor !== "string" || !HEX.test(body.primaryColor.trim())) {
      throw new Error("COLOR");
    }
    primaryColor = body.primaryColor.trim().toLowerCase();
  }
  let locale: GuestAppLocale | null = null;
  if (body.locale != null && body.locale !== "") {
    if (typeof body.locale !== "string" || !GUEST_APP_LOCALES.includes(body.locale as GuestAppLocale)) {
      throw new Error("LOCALE");
    }
    locale = body.locale as GuestAppLocale;
  }
  const deskPhone = optionalString(body.deskPhone, 32);
  if (deskPhone && !/^[0-9+().\-\s]+$/.test(deskPhone)) throw new Error("PHONE");
  const postStayMessage = optionalString(body.postStayMessage, 2000);
  const doctorOnDutyPhone = optionalString(body.doctorOnDutyPhone, 32);
  if (doctorOnDutyPhone && !/^[0-9+().\-\s]+$/.test(doctorOnDutyPhone)) throw new Error("PHONE");
  let leadAlertMinutes: number | null = null;
  if (body.leadAlertMinutes != null && body.leadAlertMinutes !== "") {
    const n = Number(body.leadAlertMinutes);
    if (n !== 5 && n !== 10) throw new Error("LEAD_ALERT");
    leadAlertMinutes = n;
  }
  return {
    enabled: body.enabled,
    displayName,
    primaryColor,
    logoUrl,
    locale,
    deskPhone,
    catalogJson: body.catalogJson ?? null,
    postStayMessage,
    offersJson: body.offersJson ?? null,
    doctorOnDutyPhone,
    leadAlertMinutes,
    enabledOrderKinds: body.enabledOrderKinds ?? null,
  };
}
