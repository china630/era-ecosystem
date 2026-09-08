import {
  composePersonFullName,
  isValidAzFin,
  linkPersonIdentity,
  lookupGlobalPersonByFin,
  normalizeNationalityIso,
  resolveIncomingNameParts,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fin?: string;
      passport?: string;
      issuingCountry?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      fullName?: string;
      phone?: string;
      nationality?: string;
    };
    const fin = body.fin?.trim();
    const parts = resolveIncomingNameParts(body);
    const fullName =
      composePersonFullName(parts?.firstName, parts?.middleName, parts?.lastName) ||
      body.fullName?.trim() ||
      "";
    const orgId = requestOrganizationId();

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

    if (!fullName && !(parts?.firstName?.trim() && parts?.lastName?.trim())) {
      return jsonError("fullName or firstName+lastName required when FIN not found", 400);
    }

    const linked = await linkPersonIdentity(
      {
        fin: fin || undefined,
        passport: body.passport?.trim(),
        issuingCountry: body.issuingCountry?.trim() || undefined,
        firstName: parts?.firstName?.trim() || undefined,
        middleName: parts?.middleName?.trim() || undefined,
        lastName: parts?.lastName?.trim() || undefined,
        fullName: fullName || undefined,
        phone: body.phone?.trim(),
        nationality: normalizeNationalityIso(body.nationality) ?? undefined,
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
