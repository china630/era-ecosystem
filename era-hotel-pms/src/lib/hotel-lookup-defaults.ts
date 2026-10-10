/**
 * Canonical HotelLookup seed rows (guest card / reservation pick-lists).
 * Shared by prisma/seed-reference and runtime ensureHotelLookupsSeeded.
 */
import { ISO_COUNTRIES } from './iso-countries';
export type HotelLookupDefault = {
  kind: string;
  code: string;
  name: string;
  sortOrder: number;
  nameEn?: string;
  nameAz?: string;
  nameRu?: string;
};

function mapCodes(
  kind: string,
  codes: readonly string[],
  names?: Record<string, string>,
): HotelLookupDefault[] {
  return codes.map((code, i) => ({
    kind,
    code,
    name: names?.[code] ?? code,
    sortOrder: (i + 1) * 10,
  }));
}

export const HOTEL_LOOKUP_DEFAULTS: HotelLookupDefault[] = [
  ...mapCodes('MARKET', ['Direct', 'Agency', 'Corporate', 'FIT', 'B2B']),
  ...mapCodes('SEGMENT', ['Leisure', 'Medical', 'Sanatorium', 'Group', 'Business']),
  ...mapCodes('VIP_TYPE', ['VIP', 'VVIP', 'NONE']),
  ...mapCodes('LOYALTY_TIER', ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM']),
  ...mapCodes('VISA_TYPE', ['TOURIST', 'BUSINESS', 'TRANSIT', 'RESIDENCE']),
  ...mapCodes('TITLE', ['Mr', 'Mrs', 'Ms', 'Dr']),
  ...mapCodes(
    'GENDER',
    ['M', 'F', 'OTHER'],
    { M: 'Male', F: 'Female', OTHER: 'Other' },
  ),
  ...mapCodes('MARITAL_STATUS', ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER']),
  ...mapCodes('TRIP_REASON', ['Leisure', 'Medical', 'Business', 'Event', 'Other']),
  ...mapCodes('ACCOM_TYPE', ['RO', 'BB', 'HB', 'FB', 'AI']),
  ...mapCodes('RECORD_TYPE', ['INDIVIDUAL', 'GROUP', 'COMPANY']),
  ...mapCodes('SPECIAL_STATE', ['EARLY_CI', 'LATE_CO', 'NO_SMOKING', 'ACCESSIBLE']),
  ...mapCodes('VERIFICATION_STATUS', ['UNVERIFIED', 'PENDING', 'VERIFIED']),
  ...mapCodes('NOTE_TYPE', [
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
  ]),
  ...mapCodes('CONCIERGE_CATEGORY', ['EXCURSION', 'TICKET', 'RESTAURANT_EXT']),
  ...mapCodes('EVENT_LINE_KIND', ['MENU', 'EQUIPMENT', 'STAFF', 'ROOM_RENTAL', 'OTHER']),
  ...mapCodes(
    'WALKIN_PROFILE',
    ['FERDI', 'FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'DIGER'],
    {
      FERDI: 'Fərdi',
      FACEBOOK: 'Facebook',
      INSTAGRAM: 'Instagram',
      TELEGRAM: 'Telegram',
      DIGER: 'Digər',
    },
  ),
  {
    kind: 'RESERVATION_QUEUE',
    code: 'bookings',
    name: 'Reservations',
    nameEn: 'Reservations',
    nameAz: 'Rezervasiyalar',
    nameRu: 'Бронирования',
    sortOrder: 10,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'dueIn',
    name: 'Expected today',
    nameEn: 'Expected today',
    nameAz: 'Bu gün gözlənilən',
    nameRu: 'Ожидаются (сегодня)',
    sortOrder: 20,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'inHouse',
    name: 'In house',
    nameEn: 'In house',
    nameAz: 'Qalırlar',
    nameRu: 'Проживают',
    sortOrder: 30,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'dueOut',
    name: 'Departing today',
    nameEn: 'Departing today',
    nameAz: 'Bu gün çıxanlar',
    nameRu: 'Выезжающие (сегодня)',
    sortOrder: 40,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'departed',
    name: 'Departed',
    nameEn: 'Departed',
    nameAz: 'Çıxıblar',
    nameRu: 'Выехавшие',
    sortOrder: 50,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'noShow',
    name: 'No-show',
    nameEn: 'No-show',
    nameAz: 'No-show',
    nameRu: 'No-show',
    sortOrder: 60,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'cancel',
    name: 'Cancelled',
    nameEn: 'Cancelled',
    nameAz: 'Ləğv',
    nameRu: 'Отмена',
    sortOrder: 70,
  },
  {
    kind: 'RESERVATION_QUEUE',
    code: 'all',
    name: 'All',
    nameEn: 'All',
    nameAz: 'Hamısı',
    nameRu: 'Все',
    sortOrder: 80,
  },
  ...ISO_COUNTRIES.map((country, index) => ({
    kind: 'NATIONALITY',
    code: country.code,
    name: country.nameEn,
    nameEn: country.nameEn,
    nameAz: country.nameAz,
    nameRu: country.nameRu,
    sortOrder: (index + 1) * 10,
  })),
];
