import { closeEpisodes } from "@/lib/lifecycle-consumer";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";
import { openEpisodeFromStay } from "@/lib/services/sanatorium.service";
import {
  planClinicStayReconcile,
  type StayReconcileGuest,
} from "@/lib/stay-reconcile-plan";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";

export type ClinicSyncSnapshot = {
  inHouse: Array<
    StayReconcileGuest & {
      sex?: string;
      birthDate?: string;
      nationality?: string;
      phone?: string;
      checkInDate?: string;
      checkOutDate?: string;
    }
  >;
  checkedOutIds: string[];
};

export async function fetchHotelClinicSyncSnapshot(
  organizationId: string,
  openReservationIds: string[],
): Promise<ClinicSyncSnapshot | null> {
  const base = (process.env.HOTEL_PMS_URL ?? process.env.ERA_HOTEL_PMS_ORIGIN ?? "http://127.0.0.1:3201").replace(/\/$/, "");
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
  if (!token) return null;
  const res = await fetch(`${base}/api/internal/v1/reservations/clinic-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ organizationId, openReservationIds }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ClinicSyncSnapshot & { data?: ClinicSyncSnapshot };
  return body.data ?? body;
}

export async function applyClinicStaySnapshot(
  organizationId: string,
  snapshot: ClinicSyncSnapshot,
): Promise<{ opened: number; patched: number; closed: number }> {
  enterRequestTenant(organizationId);
  const openEpisodes = await prisma.clinicalEpisode.findMany({
    where: { organizationId, status: "OPEN", patientOrigin: "IN_HOUSE" },
    select: {
      id: true,
      reservationId: true,
      globalPersonId: true,
      hotelStayId: true,
      programCode: true,
      roomNumber: true,
    },
  });
  const plan = planClinicStayReconcile({
    inHouse: snapshot.inHouse,
    checkedOutIds: snapshot.checkedOutIds,
    openEpisodes,
  });
  const closed = await closeEpisodes(plan.closeEpisodeIds, "hotel_reconcile");
  let opened = 0;
  let patched = 0;
  for (const guest of plan.sync) {
    await openEpisodeFromStay({
      reservationId: guest.reservationId,
      guestName: guest.guestName,
      passportNumber: guest.reservationId,
      organizationId,
      globalPersonId: guest.globalPersonId,
      programCode: guest.programCode,
      roomNumber: guest.roomNumber,
      paxKey: guest.paxKey,
      sex: guest.sex,
      birthDate: guest.birthDate,
      nationality: guest.nationality,
      phone: guest.phone,
    });
    if (plan.open.includes(guest)) opened += 1;
    else patched += 1;
  }
  return { opened, patched, closed: closed.closed };
}

export async function reconcileClinicStayOrganization(organizationId: string) {
  const hotelOrg = await getClinicHotelOrganizationId(organizationId);
  if (!hotelOrg) return { organizationId, skipped: "hotel-not-linked" as const };
  enterRequestTenant(hotelOrg);
  const open = await prisma.clinicalEpisode.findMany({
    where: { status: "OPEN", patientOrigin: "IN_HOUSE", reservationId: { not: null } },
    select: { reservationId: true },
  });
  const openReservationIds = [
    ...new Set(open.map((row) => row.reservationId).filter((id): id is string => Boolean(id))),
  ];
  const snapshot = await fetchHotelClinicSyncSnapshot(hotelOrg, openReservationIds.slice(0, 200));
  if (!snapshot) return { organizationId, skipped: "hotel-unavailable" as const };
  const result = await applyClinicStaySnapshot(hotelOrg, snapshot);
  return { organizationId, ...result };
}

let running = false;

/** Open missing in-house courses, close checked-out ones, pull package, room, and guest facts. */
export async function reconcileClinicStays(): Promise<{ byOrganization: unknown[] }> {
  if (running) return { byOrganization: [] };
  running = true;
  try {
    const { fetchClinicPoolOrganizationIds } = await import("@/lib/cron-organization-ids");
    const orgs = await fetchClinicPoolOrganizationIds();
    const byOrganization = [];
    for (const organizationId of orgs) {
      byOrganization.push(await reconcileClinicStayOrganization(organizationId));
    }
    return { byOrganization };
  } finally {
    running = false;
  }
}
