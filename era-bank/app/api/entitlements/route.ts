import { getSatelliteSession, jsonError, handleRouteError } from "@/lib/api-utils";
import { bankActiveModules } from "@/lib/bank-entitlement-modules";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return Response.json({ modules: await bankActiveModules() });
  } catch (err) {
    return handleRouteError(err);
  }
}
