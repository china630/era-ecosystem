/** Deep links from hotel guest CRM into independent industry satellites. */

export type ClinicGuestSection =
  | 'health'
  | 'history'
  | 'followUp'
  | 'labs'
  | 'labsNew';

const CLINIC_PATHS: Record<ClinicGuestSection, string> = {
  health: '/sanatorium',
  history: '/sanatorium',
  followUp: '/sanatorium',
  labs: '/lab-orders',
  labsNew: '/lab-orders',
};

export function clinicWebBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_CLINIC_WEB_URL?.trim() ||
    process.env.NEXT_PUBLIC_SATELLITE_CLINIC_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function clinicGuestDeepLink(
  guestId: string,
  section: ClinicGuestSection = 'health',
): string | null {
  const base = clinicWebBaseUrl();
  if (!base) return null;
  const path = CLINIC_PATHS[section];
  const q = new URLSearchParams({ guestId, hotelGuestId: guestId });
  if (section === 'labsNew') q.set('action', 'new');
  return `${base}${path}?${q.toString()}`;
}

export function isClinicDeepLinkConfigured(): boolean {
  return clinicWebBaseUrl() !== null;
}

export function logisticsWebBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SATELLITE_LOGISTICS_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function logisticsGuestDeepLink(guestId: string): string | null {
  const base = logisticsWebBaseUrl();
  if (!base) return null;
  return `${base}/transfers?guestId=${encodeURIComponent(guestId)}`;
}

export function posWebBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SATELLITE_FNB_POS_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function posGuestDeepLink(guestId: string): string | null {
  const base = posWebBaseUrl();
  if (!base) return null;
  return `${base}/guests/${encodeURIComponent(guestId)}/habits`;
}
