import {
  getSatelliteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  loadPatientAssignmentLedger,
  type AssignmentKind,
} from "@/domain/reports/patient-assignment-ledger";

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_REPORTS_PROCEDURES,
    );
    if (denied) return denied;
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const episodeId = (url.searchParams.get("episodeId") ?? "").trim();
    if (!episodeId) return jsonError("episodeId required", 400);

    const roomNumber = url.searchParams.get("roomNumber")?.trim() || null;
    const kindRaw = url.searchParams.get("kind")?.trim() || "all";
    const kind =
      kindRaw === "procedure" || kindRaw === "lab" || kindRaw === "visit"
        ? (kindRaw as AssignmentKind)
        : "all";

    const data = await loadPatientAssignmentLedger({
      episodeId,
      roomNumber,
      kind,
    });
    if (!data) return jsonError("Episode not found", 404);
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
