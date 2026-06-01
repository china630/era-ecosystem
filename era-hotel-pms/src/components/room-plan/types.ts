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
  roomType: { code: string };
}

export interface RoomPlanReservationBar {
  id: string;
  resNo?: string | null;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  paymentMethod?: string | null;
  totalAmount?: number | string | null;
  adults?: number | null;
  guest: { fullName: string };
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
