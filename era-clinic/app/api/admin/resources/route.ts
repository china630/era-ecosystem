import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listResources,
  createResource,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["ROOM", "EQUIPMENT"]).default("EQUIPMENT"),
  capacity: z.number().int().positive().optional(),
  roomId: z.string().nullable().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk(await listResources());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createResource(body);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "resource",
      row.id,
      "CREATE",
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
