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
import { loadCatalogDisplayNameMap } from "@/domain/catalog/catalog-display-name.service";
import { readUiLocale } from "@/lib/request-locale";
import {
  deletePendingExtra,
  listExtraUnitPrices,
  listPaidExtras,
  listPendingExtras,
  prescribeExtras,
} from "@/domain/sanatorium/extras-assign.service";

const prescribeSchema = z.object({
  lines: z
    .array(
      z.object({
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
      }),
    )
    .min(1),
});

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
    const [rows, paid] = await Promise.all([
      listPendingExtras(id),
      listPaidExtras(id),
    ]);
    const prices = await listExtraUnitPrices();
    const locale = await readUiLocale(req);
    const catalogNames = await loadCatalogDisplayNameMap(
      [...rows, ...paid].map((row) => row.procedureCode),
      locale,
    );
    return jsonOk({
      items: rows.map((r) => ({
        id: r.id,
        procedureCode: r.procedureCode,
        procedureName: catalogNames.get(r.procedureCode) || r.procedureName,
        amountNet: Number(r.amountNet),
        note: r.note,
        status: r.status,
      })),
      prices,
      paid: paid.map((r) => ({
        id: r.id,
        procedureCode: r.procedureCode,
        procedureName: catalogNames.get(r.procedureCode) || r.procedureName,
        amountNet: Number(r.amountNet),
      })),
    });
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
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
    const body = prescribeSchema.parse(await req.json());
    const result = await prescribeExtras(id, body.lines);
    return jsonOk(result);
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
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
    const orderId = url.searchParams.get("orderId");
    if (!orderId) return jsonError("orderId required", 400);
    await deletePendingExtra(orderId);
    return jsonOk({ ok: true });
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
    return handleRouteError(err);
  }
}
