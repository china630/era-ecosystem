import type { PaymentMethod } from '@prisma/client';

export type OtaReservationPayload = {
  externalReservationId: string;
  event: 'create' | 'modify' | 'cancel';
  channelCode: string;
  guest: {
    externalGuestId?: string;
    fullName: string;
    email?: string;
    phone?: string;
  };
  checkInDate: string;
  checkOutDate: string;
  otaRoomCode: string;
  otaRateCode?: string;
  adults?: number;
  children?: number;
  totalAmount?: number;
  currency?: string;
  paymentMethod?: PaymentMethod;
};

export type AvailabilityPushRow = {
  date: string;
  channelCode?: string;
  otaRoomCode: string;
  /** OTA rate plan code from ChannelRateMapping (ARI — not room-only). */
  otaRateCode?: string;
  ratePlanCode?: string;
  available: number;
  price?: number;
  /** True when ChannelStopSell covers this room type / date. */
  stopSell?: boolean;
};

export type SyncResult = {
  ok: boolean;
  pushed?: number;
  message?: string;
  errors?: string[];
};

export interface ChannelAdapter {
  readonly code: string;
  pullReservations?(_since: Date): Promise<OtaReservationPayload[]>;
  pushAvailability(_rows: AvailabilityPushRow[]): Promise<SyncResult>;
  ackReservation?(_externalId: string): Promise<void>;
}
