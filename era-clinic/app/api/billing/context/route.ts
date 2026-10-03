import { NextResponse } from "next/server";
import {
  getSatelliteSession,
  requireClinicPermission,
  handleRouteError,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { isWalkInDeferredToHub } from "@/lib/billing-router";

export async function GET(_req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_CASHIER,
    );
    if (denied) return denied;

    const deferWalkInToHub = await isWalkInDeferredToHub();
    return NextResponse.json({ deferWalkInToHub });
  } catch (err) {
    return handleRouteError(err);
  }
}
