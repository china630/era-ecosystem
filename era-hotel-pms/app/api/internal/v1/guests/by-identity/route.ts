import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { enterRequestTenant } from "@/lib/request-organization";
import { lookupGuestGlobalPersonByIdentity } from "@/lib/services/guest-identity-lookup.service";
import { assertEnvServiceToken } from "@era/satellite-kit";

const querySchema = z.object({
  organizationId: z.string().min(1),
  fullName: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().optional(),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Clinic #21 cutover: Guest by given+surname (+patronymic) + birthDate + optional phone.
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
      organizationId: url.searchParams.get("organizationId") ?? "",
      fullName: url.searchParams.get("fullName") ?? "",
      birthDate: url.searchParams.get("birthDate") ?? "",
      phone: url.searchParams.get("phone") || undefined,
    });
    if (!parsed.success) {
      return Response.json(
        { error: "organizationId, fullName, and birthDate (YYYY-MM-DD) required" },
        { status: 400 },
      );
    }

    const { organizationId, fullName, birthDate, phone } = parsed.data;
    enterRequestTenant(organizationId);

    const globalPersonId = await lookupGuestGlobalPersonByIdentity({
      organizationId,
      fullName,
      birthDate,
      phone,
    });
    return jsonOk({
      found: Boolean(globalPersonId),
      globalPersonId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
