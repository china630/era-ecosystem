import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import {
  PackageAssignError,
  assignPackageProcedures,
  getPackageAssignSnapshot,
} from "@/domain/sanatorium/package-assign.service";

const lineSchema = z.object({
  procedureCode: z.string().min(1),
  qty: z.number().int().positive().max(40),
  note: z.string().max(2000).optional().nullable(),
  bodyPart: z.string().max(64).optional().nullable(),
  physioFields: z.record(z.unknown()).optional().nullable(),
  siteIds: z.array(z.string()).optional(),
  siteApplyMode: z.enum(["TURN", "TOGETHER"]).optional().nullable(),
  siteLaterality: z
    .record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable())
    .optional(),
});

const assignSchema = z.object({
  lines: z.array(lineSchema).min(1),
});

function mapAssignError(err: unknown) {
  if (err instanceof PackageAssignError) {
    return jsonError(err.message, err.status, { code: err.code });
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = await params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const snap = await getPackageAssignSnapshot(id);
    return jsonOk(snap);
  } catch (err) {
    const mapped = mapAssignError(err);
    if (mapped) return mapped;
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return denied;
    const { id } = await params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = assignSchema.parse(await req.json());
    const result = await assignPackageProcedures(id, body.lines, {
      confirmedByUserId: session.sub,
    });
    return jsonOk(result);
  } catch (err) {
    const mapped = mapAssignError(err);
    if (mapped) return mapped;
    return handleRouteError(err);
  }
}
