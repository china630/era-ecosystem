import { z } from "zod";
import { mergePersonRecords } from "@era/satellite-kit";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";

const schema = z.object({
  patientRefId: z.string(),
  sourcePersonId: z.string().uuid(),
  targetPersonId: z.string().uuid(),
  fin: z.string().trim().min(7),
  fullName: z.string().trim().min(1),
});

/** Ops: foreigner received FIN — merge MDM records and re-link patient. */
export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM);
    if (denied) return denied;

    const body = schema.parse(await req.json());
    const merged = await mergePersonRecords(body.sourcePersonId, body.targetPersonId);
    if (!merged.globalPersonId) {
      return jsonError("MDM merge failed", 502);
    }
    await linkPatientGlobalPerson({
      patientRefId: body.patientRefId,
      fin: body.fin,
      fullName: body.fullName,
    });
    return jsonOk({ globalPersonId: merged.globalPersonId });
  } catch (err) {
    return handleRouteError(err);
  }
}
