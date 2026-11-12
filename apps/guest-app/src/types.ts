import type { QueuedOrder, TripPack } from "./trip-store";

export type Brand = {
  enabled: boolean;
  displayName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  locale: "az" | "ru" | "en" | null;
  catalogJson?: unknown;
  postStayMessage?: string | null;
  offersJson?: unknown;
  deskPhone?: string | null;
  doctorOnDutyPhone?: string | null;
  leadAlertMinutes?: number | null;
  enabledOrderKinds?: unknown;
};

export const DEFAULT_ORDER_KINDS = ["HOUSEKEEPING", "DND", "TOWELS"] as const;

export function orderKindsFromBrand(brand: Brand | null): string[] {
  const raw = brand?.enabledOrderKinds;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(String).filter(Boolean);
  }
  return [...DEFAULT_ORDER_KINDS];
}

export type BookingRow = { id: string; status: string; checkIn: string; checkOut: string };
export type OrderRow = { id: string; kind: string; status: string };
export type CareRow = {
  id: string;
  scheduledAt?: string;
  procedureName?: string;
  title?: string;
  label?: string;
  room?: string | null;
  status?: string;
};
export type MsgRow = {
  id: string;
  kind: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};
export type FolioRow = {
  id: string;
  status: string;
  open?: boolean;
  settled?: boolean;
  lines: Array<{ id: string; label: string; amount: string }>;
};
export type BoardInfo = {
  mealPlanCode: string | null;
  breakfastIncluded: boolean;
  allInclusive: boolean;
  roomNumber?: string | null;
};

export type { QueuedOrder, TripPack };
