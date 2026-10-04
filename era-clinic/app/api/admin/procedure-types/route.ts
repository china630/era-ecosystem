import { z } from "zod";
import { jsonOk, handleRouteError, getSatelliteSession, jsonError, requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  listProcedureTypes,
  createProcedureType,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  durationMin: z.number().int().positive().optional(),
  resourceGapMinutes: z.number().int().min(0).max(240).optional(),
  patientRestMinutes: z.number().int().min(0).max(240).optional(),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
  bodyPart: z
    .enum([
      "HEAD",
      "NECK",
      "CHEST",
      "BACK",
      "ABDOMEN",
      "ARM_LEFT",
      "ARM_RIGHT",
      "LEG_LEFT",
      "LEG_RIGHT",
      "FULL_BODY",
    ])
    .nullable()
    .optional(),
  afterLunchAllowed: z.boolean().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
  needsSite: z.boolean().optional(),
  physioOrderFields: z.array(z.string().min(1)).optional(),
  allowedSiteCodes: z.array(z.string().min(1)).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const deniedMaster = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA,
    );
    const deniedTemplates = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
    if (deniedMaster && deniedTemplates) return deniedMaster;
    const locale =
      new URL(req.url).searchParams.get("locale") ??
      req.headers.get("x-era-locale") ??
      "en";
    return jsonOk(await listProcedureTypes(locale));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
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
