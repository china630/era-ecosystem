import { getSatelliteSession, jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";

/** Ops notification feed — empty until bank-core emits staff alerts. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk({ items: [], unreadCount: 0 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
