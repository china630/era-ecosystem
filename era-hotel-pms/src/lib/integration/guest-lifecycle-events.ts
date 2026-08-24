import { randomUUID } from "crypto";
import {
  SATELLITE_HOTEL_GUEST_CHECKED_IN,
  SATELLITE_HOTEL_GUEST_CHECKED_OUT,
  SATELLITE_HOTEL_ROOM_CHANGED,
  SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED,
  SATELLITE_HOTEL_STAY_PRODUCT_CHANGED,
} from "@era/contracts";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit/orchestrator-gateway";

async function publishLifecycle(event: Record<string, unknown>) {
  const organizationId = satelliteOrganizationId();
  if (!organizationId || organizationId === "demo-org") return;
  await publishToOrchestratorGateway({
    ...event,
    organizationId,
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}

export async function dispatchGuestCheckedIn(input: {
  reservationId: string;
  roomNumber?: string;
  programCode?: string;
  globalPersonId?: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
}) {
  const event = {
    type: SATELLITE_HOTEL_GUEST_CHECKED_IN,
    globalPersonId: input.globalPersonId,
    payload: {
      reservationId: input.reservationId,
      roomNumber: input.roomNumber,
      programCode: input.programCode,
      globalPersonId: input.globalPersonId,
      guestName: input.guestName,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
    },
  };
  await publishLifecycle(event);
}

export async function dispatchGuestCheckedOut(input: {
  reservationId: string;
  roomNumber?: string;
  programCode?: string;
  earlyCheckout?: boolean;
}) {
  const event = {
    type: SATELLITE_HOTEL_GUEST_CHECKED_OUT,
    payload: {
      reservationId: input.reservationId,
      roomNumber: input.roomNumber,
      programCode: input.programCode,
      earlyCheckout: input.earlyCheckout,
    },
  };
  await publishLifecycle(event);
}

export async function dispatchSanatoriumBookingCreated(input: {
  reservationId: string;
  programCode?: string;
  globalPersonId?: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
}) {
  const event = {
    type: SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED,
    globalPersonId: input.globalPersonId,
    payload: {
      reservationId: input.reservationId,
      programCode: input.programCode,
      globalPersonId: input.globalPersonId,
      guestName: input.guestName,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
    },
  };
  await publishLifecycle(event);
}

export async function dispatchRoomChanged(input: {
  reservationId: string;
  previousRoomNumber?: string;
  newRoomNumber: string;
  programCode?: string;
}) {
  const event = {
    type: SATELLITE_HOTEL_ROOM_CHANGED,
    payload: {
      reservationId: input.reservationId,
      previousRoomNumber: input.previousRoomNumber,
      newRoomNumber: input.newRoomNumber,
      programCode: input.programCode,
    },
  };
  await publishLifecycle(event);
}

export async function dispatchStayProductChanged(input: {
  reservationId: string;
  programCode?: string;
  previousProgramCode?: string;
  effectiveDate: string;
  roomTypeId?: string;
  ratePlanId?: string;
  globalPersonId?: string;
  roomNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
}) {
  const event = {
    type: SATELLITE_HOTEL_STAY_PRODUCT_CHANGED,
    globalPersonId: input.globalPersonId,
    payload: {
      reservationId: input.reservationId,
      programCode: input.programCode,
      newProgramCode: input.programCode,
      previousProgramCode: input.previousProgramCode,
      effectiveDate: input.effectiveDate,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
      globalPersonId: input.globalPersonId,
      roomNumber: input.roomNumber,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
    },
  };
  await publishLifecycle(event);
}
