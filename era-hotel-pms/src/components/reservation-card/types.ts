export type TabId = 'guests' | 'pricing' | 'folio' | 'notes';
export type FolioSubTab = 'all' | 'agency' | 'guest' | 'first' | 'second';
export type BottomTab = 'details' | 'notes' | 'folio';

export type PaxRow = {
  id?: string;
  /** Linked Guest master record when picked/created from FO. */
  guestId?: string;
  title: string;
  gender: string;
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate: string;
  age: string;
  idCardNo: string;
  passportNo: string;
  memberNo: string;
  payStatus: string;
  externalResId: string;
  guestState: string;
  /** Folio / reservation master guest — exactly one per stay in PRIMARY mode. */
  isPrimary: boolean;
  /** Owns a personal GUEST folio (EQUAL: all; PRIMARY: only primary). */
  ownsFolio?: boolean;
};

export type DailyRateRow = {
  stayDate: string;
  amount: number;
  currencyCode?: string;
  fixPrice?: boolean;
  discountPct?: number | null;
  manualFlag?: boolean;
};

export type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: string;
};

export type SelectOption = { id: string; label: string; adultCapacity?: number };

export type SourceOption = SelectOption & { code: string };

export type AgencyOption = SelectOption & { code: string; isOta: boolean };

export type PartyBillingMode = 'PRIMARY' | 'EQUAL';

/** FO product dropdown — Nafta packages are medicalFlag rate plans; BAR is BASE. */
export type RatePlanOption = SelectOption & {
  code?: string;
  /** BASE = BAR (all room types via RoomTypeRate); DERIVED = package / channel. */
  type?: string;
  medicalFlag?: boolean;
  mealPlanId?: string | null;
  /** When set, plan is scoped to this room type (e.g. PKG-PREMIUM → DLX). */
  roomTypeId?: string | null;
};

export type RoomOption = { id: string; roomNumber: string; status: string };
