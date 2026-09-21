import { getRouteSession, jsonError, jsonOk } from "@/lib/api-utils";

/** Ops notification feed — empty until bank-core emits staff alerts. */
export async function GET() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);
  return jsonOk({ items: [], unreadCount: 0 });
}

export async function PATCH() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);
  return jsonOk({ ok: true });
}
