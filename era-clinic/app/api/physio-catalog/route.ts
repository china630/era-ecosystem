import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { getActivePhysioCatalog } from "@/domain/physio/physio-catalog.service";

/** Ops read of active S + programs + substances (W3 type-gated fields). */
export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk(await getActivePhysioCatalog());
  } catch (err) {
    return handleRouteError(err);
  }
}
