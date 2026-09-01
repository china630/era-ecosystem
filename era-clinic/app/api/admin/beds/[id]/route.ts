import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateBed, deleteBed } from "@/domain/inpatient/ward.service";
import { z } from "zod";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertClinicAdminRoute(request);
  if (guard.error) return guard.error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const bed = await updateBed(id, body);
    return jsonOk({ data: bed });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertClinicAdminRoute(request);
  if (guard.error) return guard.error;
  try {
    const { id } = await params;
    await deleteBed(id);
    return jsonOk({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("active")) return jsonError(msg, 409);
    return handleRouteError(err);
  }
}
