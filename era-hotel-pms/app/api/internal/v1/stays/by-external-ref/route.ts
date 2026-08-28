import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";
import { pickStayGlobalPersonId } from "@/lib/services/stay-person-lookup.service";
import { assertEnvServiceToken } from "@era/satellite-kit";

const querySchema = z.object({
  externalRef: z.string().min(1),
  organizationId: z.string().min(1),
  folioPerson: z.coerce.number().int().positive().optional(),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Clinic #21 cutover: resolve hotel stay by Elektraweb RESID / RESNAMEID → MDM person.
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN.
 */
export async function GET(request: Request) {
  try {
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
    if (!gate.ok) return unauthorized(gate.error);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      externalRef: url.searchParams.get("externalRef") ?? "",
      organizationId: url.searchParams.get("organizationId") ?? "",
      folioPerson: url.searchParams.get("folioPerson") || undefined,
    });
    if (!parsed.success) {
      return Response.json({ error: "externalRef and organizationId required" }, { status: 400 });
    }

    const { externalRef, organizationId, folioPerson } = parsed.data;
    enterRequestTenant(organizationId);

    const stay = await prisma.reservation.findFirst({
      where: {
        organizationId,
        OR: [{ externalRef }, { elektrawebResNameId: externalRef }, { id: externalRef }],
      },
      select: {
        id: true,
        guest: { select: { globalPersonId: true } },
        paxGuests: {
          select: {
            sortOrder: true,
            isPrimary: true,
            guest: { select: { globalPersonId: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!stay) {
      return Response.json({ found: false, globalPersonId: null }, { status: 200 });
    }

    const globalPersonId = pickStayGlobalPersonId(
      {
        guest: stay.guest,
        reservationGuests: stay.paxGuests,
      },
      folioPerson ?? null,
    );
    return jsonOk({
      found: true,
      reservationId: stay.id,
      globalPersonId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
