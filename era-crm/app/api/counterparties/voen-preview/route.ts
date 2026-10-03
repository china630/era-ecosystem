import { fetchVoenPreviewFromRequest } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const result = await fetchVoenPreviewFromRequest(req);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
