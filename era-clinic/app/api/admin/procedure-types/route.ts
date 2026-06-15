import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  listProcedureTypes,
  createProcedureType,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  durationMin: z.number().int().positive().optional(),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk(await listProcedureTypes());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createProcedureType(body);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureType",
      row.id,
      "CREATE",
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
