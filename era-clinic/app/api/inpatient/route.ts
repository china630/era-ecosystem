import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  admitPatient,
  dischargeAdmission,
  listInpatientCensus,
  listWardsWithPatients,
  transferAdmission,
} from "@/domain/inpatient/adt.service";

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

        const view = new URL(req.url).searchParams.get("view");
    if (view === "census") {
      return jsonOk({ items: await listInpatientCensus() });
    }
    const wards = await listWardsWithPatients();
    return jsonOk({ wards });
  } catch (err) {
    return handleRouteError(err);
  }
}

const admitSchema = z.object({
  action: z.enum(["admit", "transfer", "discharge"]).optional(),
  bedId: z.string().optional(),
  patientRefId: z.string().optional(),
  admissionId: z.string().optional(),
  newBedId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

        const body = admitSchema.parse(await req.json());
    const action = body.action ?? "admit";

    if (action === "admit") {
      if (!body.bedId || !body.patientRefId) {
        return jsonError("bedId and patientRefId required", 400);
      }
      const result = await admitPatient(body.patientRefId, body.bedId);
      return jsonOk(result, 201);
    }
    if (action === "transfer") {
      if (!body.admissionId || !body.newBedId) {
        return jsonError("admissionId and newBedId required", 400);
      }
      const assignment = await transferAdmission(body.admissionId, body.newBedId);
      return jsonOk({ assignment });
    }
    if (action === "discharge") {
      if (!body.admissionId) return jsonError("admissionId required", 400);
      const admission = await dischargeAdmission(body.admissionId);
      return jsonOk({ admission });
    }
    return jsonError("Unknown action", 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg.includes("occupied") || msg.includes("not available")) {
      return jsonError(msg, 409);
    }
    return handleRouteError(err);
  }
}
