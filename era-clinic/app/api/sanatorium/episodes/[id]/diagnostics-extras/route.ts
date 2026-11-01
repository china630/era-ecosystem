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
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import {
  deletePendingDiagnostic,
  listPendingDiagnostics,
  payDiagnosticsExtras,
  prescribeDiagnosticsExtras,
} from "@/domain/sanatorium/diagnostics-extras.service";
import { listExtraUnitPrices } from "@/domain/sanatorium/extras-assign.service";

const prescribeSchema = z.object({
  lines: z
    .array(
      z.object({
        serviceCode: z.string().min(1),
        qty: z.number().int().positive().max(40),
        note: z.string().max(2000).optional().nullable(),
        scheduledAt: z.string().max(32).optional().nullable(),
      }),
    )
    .min(1),
});

const paySchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["lab", "visit"]),
      }),
    )
    .min(1),
});

function mapError(err: unknown) {
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
    const [items, prices] = await Promise.all([
      listPendingDiagnostics(id),
      listExtraUnitPrices(),
    ]);
    return jsonOk({ items, prices });
  } catch (err) {
    const mapped = mapError(err);
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
    const raw = await req.json();
    if (raw?.action === "pay") {
      const body = paySchema.parse(raw);
      const result = await payDiagnosticsExtras(body.lines, session.sub);
      return jsonOk(result);
    }
    const body = prescribeSchema.parse(raw);
    const result = await prescribeDiagnosticsExtras(id, body.lines, session.sub);
    return jsonOk(result);
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    return handleRouteError(err);
  }
}

export async function DELETE(
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
    const url = new URL(req.url);
    const rowId = url.searchParams.get("id");
    const kind = url.searchParams.get("kind");
    if (!rowId || (kind !== "lab" && kind !== "visit")) {
      return jsonError("id and kind=lab|visit required", 400);
    }
    await deletePendingDiagnostic(kind, rowId);
    return jsonOk({ ok: true });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    return handleRouteError(err);
  }
}
