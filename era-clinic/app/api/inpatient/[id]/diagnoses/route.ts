import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  addAdmissionDiagnosis,
  deleteAdmissionDiagnosis,
  listAdmissionDiagnoses,
} from "@/domain/icd/diagnosis-write.service";

const createSchema = z.object({
  icdCodeId: z.string().min(1),
  kind: z.enum(["ADMISSION", "DISCHARGE"]).optional(),
  role: z.enum(["PRIMARY", "SECONDARY"]).optional(),
  note: z.string().max(500).optional().nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

        const { id } = await ctx.params;
    return jsonOk({ items: await listAdmissionDiagnoses(id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

    const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    const row = await addAdmissionDiagnosis(id, {
      ...body,
      recordedByUserId: session.sub,
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

        const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await deleteAdmissionDiagnosis(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
