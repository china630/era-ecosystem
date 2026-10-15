import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { closeOpenEpisodesForReservation } from "@/lib/lifecycle-consumer";
import { enterRequestTenant } from "@/lib/request-organization";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";

/**
 * Repair OPEN episodes whose hotel stay is already CHECKED_OUT.
 * A missed checkout event is the only reason. The planned date does not close a course.
 */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_sanatorium",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => {
        const hotelOrg = await getClinicHotelOrganizationId(organizationId);
        if (!hotelOrg) return { organizationId, closed: 0, reason: "hotel-not-linked" };
        // Hotel lifecycle stores the course under the hotel organization.
        enterRequestTenant(hotelOrg);
        const open = await prisma.clinicalEpisode.findMany({
          where: { status: "OPEN", patientOrigin: "IN_HOUSE", reservationId: { not: null } },
          select: { reservationId: true },
        });
        const reservationIds = [...new Set(open.map((row) => row.reservationId).filter((id): id is string => Boolean(id)))];
        if (reservationIds.length === 0) return { organizationId, closed: 0 };
        const base = (process.env.HOTEL_PMS_URL ?? process.env.ERA_HOTEL_PMS_ORIGIN ?? "http://127.0.0.1:3201").replace(/\/$/, "");
        const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
        if (!token) return { organizationId, closed: 0, reason: "token-missing" };
        const res = await fetch(`${base}/api/internal/v1/reservations/checked-out`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ organizationId: hotelOrg, reservationIds: reservationIds.slice(0, 200) }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return { organizationId, closed: 0, reason: "hotel-unavailable" };
        const body = (await res.json()) as { ids?: string[]; data?: { ids?: string[] } };
        const ids = body.data?.ids ?? body.ids ?? [];
        let closed = 0;
        for (const reservationId of ids) {
          const result = await closeOpenEpisodesForReservation(reservationId);
          closed += result.closed;
        }
        return { organizationId, closed };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) return Response.json({ error: gate.reason }, { status: 503 });
      return jsonOk({ skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return jsonOk({ byOrganization: gate.results });
  } catch (err) {
    return handleRouteError(err);
  }
}
