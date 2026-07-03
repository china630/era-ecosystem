import { listPersonIdentifiers } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError, getRouteSession } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const globalPersonId = new URL(request.url).searchParams.get("globalPersonId")?.trim();
    if (!globalPersonId) {
      return jsonError("globalPersonId query parameter is required", 400);
    }
    const result = await listPersonIdentifiers(globalPersonId);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
