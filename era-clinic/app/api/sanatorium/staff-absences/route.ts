import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  createStaffAbsence,
  deleteStaffAbsence,
} from "@/domain/staff/staff-duty-roster.service";

const createSchema = z.object({
  practitionerId: z.string().min(1),
  kind: z.enum(["VACATION", "SICK", "TRAINING", "OTHER"]),
  startsOn: z.string().min(10),
  endsOn: z.string().min(10),
  note: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES);
    if (denied) return denied;
    const body = createSchema.parse(await req.json());
    const row = await createStaffAbsence(body);
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffAbsence",
      row.id,
      "CREATE",
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES);
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return jsonError("id required", 400);
    }
    await deleteStaffAbsence(id);
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffAbsence",
      id,
      "DELETE",
    );
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
