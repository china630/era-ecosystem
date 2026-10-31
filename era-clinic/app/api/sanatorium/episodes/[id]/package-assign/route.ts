import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import {
  PackageAssignError,
  assignPackageMenuLines,
  getPackageAssignSnapshot,
  applyPreferredMasseurs,
  placeProposedOnCheckoutMorning,
} from "@/domain/sanatorium/package-assign.service";
import { readUiLocale } from "@/lib/request-locale";
import { parseBakuDateTime } from "@/lib/baku-day";

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
  /** Burn PHYSIO_POOL / PARAFFIN_POOL balance; procedureCode stays the real SKU. */
  burnPoolCode: z.string().min(1).optional().nullable(),
  preferredPractitionerId: z.string().min(1).nullable().optional(),
});

const staffPrefSchema = z.object({
  procedureCode: z.string().min(1),
  practitionerId: z.string().min(1).nullable(),
});

const assignSchema = z
  .object({
    lines: z.array(lineSchema).default([]),
    staffPrefs: z.array(staffPrefSchema).optional(),
    checkoutMorning: z.boolean().optional(),
    startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startHour: z.number().int().min(0).max(23).optional(),
  })
  .refine(
    (body) =>
      body.checkoutMorning === true ||
      body.lines.length > 0 ||
      (body.staffPrefs?.length ?? 0) > 0,
    { message: "lines required" },
  );

function mapAssignError(err: unknown) {
  if (err instanceof PackageAssignError) {
    return jsonError(err.message, err.status, { code: err.code, misses: err.misses });
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = await params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const locale = await readUiLocale(req);
    const snap = await getPackageAssignSnapshot(id, locale);
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
    const session = await getSatelliteSession();
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
    if (body.checkoutMorning && body.lines.length === 0) {
      const seated = await placeProposedOnCheckoutMorning(id, session.sub);
      return jsonOk(seated);
    }
    const startAt =
      body.startOn && body.startHour != null
        ? parseBakuDateTime(body.startOn, `${String(body.startHour).padStart(2, "0")}:00`)
        : null;
    const result =
      body.lines.length > 0
        ? await assignPackageMenuLines(id, body.lines, {
            confirmedByUserId: session.sub,
            startAt,
          })
        : { placed: 0, softWarn: null, orderIds: [] as string[], misses: [] as Array<{ ymd: string; procedureCode: string; procedureName: string; reason: string; staffName?: string }> };
    if (body.staffPrefs && body.staffPrefs.length > 0) {
      const applied = await applyPreferredMasseurs(id, body.staffPrefs, {
        confirmedByUserId: session.sub,
        startAt,
      });
      result.misses = [...(result.misses ?? []), ...applied.misses];
    }
    return jsonOk(result);
  } catch (err) {
    const mapped = mapAssignError(err);
    if (mapped) return mapped;
    return handleRouteError(err);
  }
}
