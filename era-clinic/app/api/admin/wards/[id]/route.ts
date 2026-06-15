import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { updateWard, deleteWard } from "@/domain/inpatient/ward.service";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  dailyChargeCode: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertClinicAdminWrite();
  if (guard.error) return guard.error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const ward = await updateWard(id, body);
    return jsonOk({ data: ward });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertClinicAdminWrite();
  if (guard.error) return guard.error;
  try {
    const { id } = await params;
    await deleteWard(id);
    return jsonOk({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("occupied")) return jsonError(msg, 409);
    return handleRouteError(err);
  }
}
