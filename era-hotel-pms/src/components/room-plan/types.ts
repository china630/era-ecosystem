export type ReservationStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OOO'
  | 'OOS'
  | 'MAINTENANCE';

export interface RoomPlanRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  inventoryStatus?: string | null;
  /** Housekeeping condition when present (DIRTY/PICKUP/CLEAN/INSPECTED). */
  hkCondition?: string | null;
  roomType: { code: string };
  sharePool?: {
    gender: string;
    occupied: number;
    capacity: number;
  } | null;
}

export interface RoomPlanReservationBar {
  id: string;
  resNo?: string | null;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  paymentMethod?: string | null;
  paidBy?: string | null;
  totalAmount?: number | string | null;
  dailyRate?: number | null;
  guestBalance?: number | null;
  agencyBalance?: number | null;
  adults?: number | null;
  children11_6?: number | null;
  children5_2?: number | null;
  children1_0?: number | null;
  mealPlanCode?: string | null;
  voucherNo?: string | null;
  note?: string | null;
  shareEligible?: boolean;
  shareGender?: string | null;
  shareBedIndex?: number | null;
  guest: { fullName: string };
  partyNames?: string[];
  roomType: { code: string };
  room?: { roomNumber: string } | null;
  agency?: { name: string } | null;
  source?: { name: string; code?: string } | null;
}

export type RoomPlanGroup = {
  key: string;
  label: string;
  roomCount: number;
  rooms: RoomPlanRoom[];
  availabilityByDay: Record<string, number>;
};

export interface PlacedBar {
  reservation: RoomPlanReservationBar;
  colStart: number;
  span: number;
}
