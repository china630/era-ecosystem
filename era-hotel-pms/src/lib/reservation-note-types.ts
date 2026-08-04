/** Seed / fallback reservation note type codes (HotelLookup NOTE_TYPE is SoR). */
export const RESERVATION_NOTE_TYPES = [
  'EXTRA_REQ',
  'RES_NOTE',
  'CIN_NOTE',
  'COUT_NOTE',
  'ROOM_NOTE',
  'CANCEL_NOTE',
  'PAYMENT_NOTE',
  'PRICE_NOTE',
  'INVOICE_NOTE',
  'CONFIRMATION',
  'GENERAL_NOTE',
  'ARRIVAL_POSTPONED',
  'DEPARTURE_EXTENDED',
  'SET_ARRIVAL_EARLY',
  'SET_DEPARTURE_EARLY',
] as const;

export type ReservationNoteTypeCode = (typeof RESERVATION_NOTE_TYPES)[number];
