import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { linkPersonIdentity } from "@era/satellite-kit";
import { buildMdmPersonLookupBody } from "@/lib/mdm-person-lookup-body";

const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: "fullName or firstName+lastName required" },
  );

export async function POST(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM);
    if (denied) return denied;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const linked = await linkPersonIdentity(buildMdmPersonLookupBody(parsed.data));
    return jsonOk(linked);
  } catch (err) {
    return handleRouteError(err);
  }
}
