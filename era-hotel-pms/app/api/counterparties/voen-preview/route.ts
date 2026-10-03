import { fetchVoenPreviewFromRequest } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const result = await fetchVoenPreviewFromRequest(req);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
