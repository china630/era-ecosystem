import { randomUUID } from "crypto";
import {
  SATELLITE_HOTEL_GUEST_CHECKED_IN,
  SATELLITE_HOTEL_GUEST_CHECKED_OUT,
  SATELLITE_HOTEL_GUEST_DEPARTED,
  SATELLITE_HOTEL_GUEST_MOVED,
  SATELLITE_HOTEL_ROOM_CHANGED,
  SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED,
  SATELLITE_HOTEL_STAY_PRODUCT_CHANGED,
} from "@era/contracts";
import { publishToOrchestratorGateway } from "@era/satellite-kit/orchestrator-gateway";
import { normalizeMedicalPackageCode } from "@/lib/services/medical-package-resolve.service";
import { mapNationalityToIso } from "@/lib/person-documents";

export async function publishLifecycle(
  event: Record<string, unknown>,
  organizationId: string,
) {
  const org = organizationId.trim();
  if (!org || org === "demo-org") {
    throw new Error("clinic lifecycle requires the stay organization");
  }
  const correlationId =
    typeof event.correlationId === "string" && event.correlationId.trim()
      ? event.correlationId.trim()
      : randomUUID();
  const result = await publishToOrchestratorGateway({
    ...event,
    organizationId: org,
    correlationId,
    occurredAt: new Date().toISOString(),
  });
  if (!result.ok) {
    throw new Error(
      `lifecycle event publish failed status=${result.status ?? "n/a"} ${result.error ?? ""}`.trim(),
    );
  }
}

async function rememberClinicLifecycle(input: {
  kind: string;
  reservationId: string;
  paxKey?: string;
  payload: Record<string, unknown>;
}) {
  const { rememberClinicLifecycle: remember } = await import(
    "@/lib/integration/clinic-lifecycle-outbox"
  );
  await remember(input);
}

export function lifecycleDemographicsFromPax(pax: {
  sex?: string | null;
  birthDate?: Date | string | null;
  nationality?: string | null;
  guest?: {
    sex?: string | null;
    birthDate?: Date | string | null;
    nationality?: string | null;
    phone?: string | null;
  } | null;
}): { sex?: string; birthDate?: string; nationality?: string; phone?: string } {
  const rawSex = pax.sex ?? pax.guest?.sex ?? undefined;
  const rawDob = pax.birthDate ?? pax.guest?.birthDate ?? undefined;
  let birthDate: string | undefined;
  if (rawDob instanceof Date && !Number.isNaN(rawDob.getTime())) {
    birthDate = rawDob.toISOString().slice(0, 10);
  } else if (typeof rawDob === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDob.trim())) {
    birthDate = rawDob.trim().slice(0, 10);
  }
  const sex = rawSex?.trim() || undefined;
  const rawNat = (pax.nationality ?? pax.guest?.nationality ?? "").trim();
  const nationality = rawNat ? (mapNationalityToIso(rawNat) ?? undefined) : undefined;
  const phone = pax.guest?.phone?.trim() || undefined;
  return {
    ...(sex ? { sex } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(nationality ? { nationality } : {}),
    ...(phone ? { phone } : {}),
  };
}

export async function dispatchGuestCheckedIn(input: {
  reservationId: string;
  roomNumber?: string;
  programCode?: string;
  globalPersonId?: string;
  phone?: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  /** Wave E — ReservationGuest.id (or similar) when MDM missing */
  paxKey?: string;
  sex?: string;
  birthDate?: string;
  nationality?: string;
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
      paxKey: input.paxKey,
      sex: input.sex,
      birthDate: input.birthDate,
      nationality: input.nationality,
      phone: input.phone,
    },
  };
  await rememberClinicLifecycle({
    kind: "CHECK_IN",
    reservationId: input.reservationId,
    paxKey: input.paxKey,
    payload: event,
  });
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
  await rememberClinicLifecycle({
    kind: "CHECK_OUT",
    reservationId: input.reservationId,
    payload: event,
  });
}

export async function dispatchGuestDeparted(input: {
  reservationId: string;
  paxKey: string;
  roomNumber?: string;
  programCode?: string;
  globalPersonId?: string;
  guestName?: string;
  checkOutDate?: string;
}) {
  const event = {
    type: SATELLITE_HOTEL_GUEST_DEPARTED,
    globalPersonId: input.globalPersonId,
    payload: {
      reservationId: input.reservationId,
      paxKey: input.paxKey,
      roomNumber: input.roomNumber,
      programCode: input.programCode,
      globalPersonId: input.globalPersonId,
      guestName: input.guestName,
      checkOutDate: input.checkOutDate,
    },
  };
  await rememberClinicLifecycle({
    kind: "DEPARTED",
    reservationId: input.reservationId,
    paxKey: input.paxKey,
    payload: event,
  });
}

export async function dispatchGuestMoved(input: {
  reservationId: string;
  fromReservationId: string;
  toReservationId: string;
  paxKey: string;
  previousRoomNumber?: string;
  newRoomNumber: string;
  programCode?: string;
  globalPersonId?: string;
  guestName?: string;
}) {
  const event = {
    type: SATELLITE_HOTEL_GUEST_MOVED,
    globalPersonId: input.globalPersonId,
    payload: {
      reservationId: input.toReservationId,
      fromReservationId: input.fromReservationId,
      toReservationId: input.toReservationId,
      paxKey: input.paxKey,
      previousRoomNumber: input.previousRoomNumber,
      newRoomNumber: input.newRoomNumber,
      programCode: input.programCode,
      globalPersonId: input.globalPersonId,
      guestName: input.guestName,
      roomNumber: input.newRoomNumber,
    },
  };
  await rememberClinicLifecycle({
    kind: "MOVED",
    reservationId: input.toReservationId,
    paxKey: input.paxKey,
    payload: event,
  });
}

export async function dispatchSanatoriumBookingCreated(input: {
  reservationId: string;
  programCode?: string;
  globalPersonId?: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomNumber?: string;
  paxKey?: string;
  sex?: string;
  birthDate?: string;
  nationality?: string;
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
      roomNumber: input.roomNumber,
      paxKey: input.paxKey,
      sex: input.sex,
      birthDate: input.birthDate,
      nationality: input.nationality,
    },
  };
  await rememberClinicLifecycle({
    kind: "BOOKING",
    reservationId: input.reservationId,
    paxKey: input.paxKey,
    payload: event,
  });
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
  await rememberClinicLifecycle({
    kind: "ROOM",
    reservationId: input.reservationId,
    payload: event,
  });
}

export async function dispatchStayProductChanged(input: {
  reservationId: string;
  programCode?: string;
  previousProgramCode?: string;
  effectiveDate: string;
  roomTypeId?: string;
  ratePlanId?: string;
  globalPersonId?: string;
  guestName?: string;
  roomNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  paxKey?: string;
  sex?: string;
  birthDate?: string;
  nationality?: string;
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
      guestName: input.guestName,
      roomNumber: input.roomNumber,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      paxKey: input.paxKey,
      sex: input.sex,
      birthDate: input.birthDate,
      nationality: input.nationality,
    },
  };
  await rememberClinicLifecycle({
    kind: "STAY_PRODUCT",
    reservationId: input.reservationId,
    paxKey: input.paxKey,
    payload: event,
  });
}

export type ClinicPackageEventKind = "booking" | "stay-product" | "none";

/**
 * Clinic hears about a stay only after check-in.
 * A saved reservation does not open an episode. Package edits while in house
 * update the course that check-in already opened.
 */
export function clinicPackageEventKind(status: string): ClinicPackageEventKind {
  if (status === "IN_HOUSE") return "stay-product";
  return "none";
}

type ClinicPackagePax = {
  id: string;
  medicalPackageCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  sex?: string | null;
  birthDate?: Date | string | null;
  nationality?: string | null;
  guest?: {
    fullName?: string | null;
    globalPersonId?: string | null;
    sex?: string | null;
    birthDate?: Date | string | null;
    nationality?: string | null;
  } | null;
};

/**
 * One clinic event per guest who has a medical SKU.
 * Checked-in stays use stay-product. A reservation that has not checked in stays quiet.
 */
export async function fanOutClinicMedicalPackages(input: {
  status: string;
  reservationId: string;
  roomNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  previousProgramCode?: string;
  datesChanged?: boolean;
  pax: ClinicPackagePax[];
}): Promise<void> {
  const kind = clinicPackageEventKind(input.status);
  if (kind === "none") return;

  const rows = input.pax.flatMap((pax) => {
    const programCode = normalizeMedicalPackageCode(pax.medicalPackageCode ?? null);
    if (!programCode) return [];
    const guestName =
      [pax.firstName, pax.lastName].filter(Boolean).join(" ") ||
      pax.guest?.fullName ||
      "Guest";
    const globalPersonId = pax.guest?.globalPersonId ?? undefined;
    return [
      {
        programCode,
        guestName,
        globalPersonId,
        paxKey: pax.id,
        ...lifecycleDemographicsFromPax(pax),
      },
    ];
  });

  if (rows.length === 0) {
    if (kind === "stay-product" && (input.datesChanged || input.previousProgramCode)) {
      await dispatchStayProductChanged({
        reservationId: input.reservationId,
        previousProgramCode: input.previousProgramCode,
        effectiveDate: new Date().toISOString(),
        roomNumber: input.roomNumber,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
      });
    }
    return;
  }

  for (const row of rows) {
    if (kind !== "stay-product") continue;
    await dispatchStayProductChanged({
      reservationId: input.reservationId,
      programCode: row.programCode,
      previousProgramCode: input.previousProgramCode,
      effectiveDate: new Date().toISOString(),
      globalPersonId: row.globalPersonId,
      guestName: row.guestName,
      roomNumber: input.roomNumber,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      paxKey: row.paxKey,
      sex: row.sex,
      birthDate: row.birthDate,
      nationality: row.nationality,
    });
  }
}
