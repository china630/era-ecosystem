import { z } from "zod";
import { mergePersonRecords } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError, getRouteSession } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
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
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
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
