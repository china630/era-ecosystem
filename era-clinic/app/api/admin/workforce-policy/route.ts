import { NextResponse } from "next/server";
import { getClinicWorkforcePolicy } from "@/lib/workforce-policy";
import { getRouteSession, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const policy = await getClinicWorkforcePolicy();
    return NextResponse.json({ data: policy });
  } catch (err) {
    return handleRouteError(err);
  }
}
