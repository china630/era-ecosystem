import {
  isValidAzFin,
  linkPersonIdentity,
  lookupGlobalPersonByFin,
} from "@era/satellite-kit";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fin?: string;
      fullName?: string;
      phone?: string;
    };
    const fin = body.fin?.trim();
    const fullName = body.fullName?.trim();
    const orgId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();

    if (fin) {
      if (!isValidAzFin(fin)) {
        return jsonError("FIN must be 7 alphanumeric characters (no I/O)", 400);
      }
      const lookup = await lookupGlobalPersonByFin(fin, {
        requesterOrgId: orgId,
        purpose: "crm_lead",
      });
      if (lookup.globalPersonId) {
        return jsonOk({ globalPersonId: lookup.globalPersonId, masked: lookup.masked });
      }
    }

    if (!fullName) {
      return jsonError("fullName required when FIN not found", 400);
    }

    const linked = await linkPersonIdentity(
      {
        fullName,
        fin: fin || undefined,
        phone: body.phone?.trim(),
      },
      { requesterOrgId: orgId, purpose: "crm_lead" },
    );

    if (!linked.globalPersonId) {
      return jsonError("Could not resolve person identity", 404);
    }

    return jsonOk({
      globalPersonId: linked.globalPersonId,
      created: linked.created,
      masked: linked.masked,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
