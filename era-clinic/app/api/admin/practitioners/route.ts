import { z } from "zod";

import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";

import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";

import { listPractitioners } from "@/lib/services/clinic-master-data.service";

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const staffKind = new URL(req.url).searchParams.get("staffKind");
    const kind =
      staffKind === "DOCTOR" || staffKind === "NURSE" || staffKind === "LAB"
        ? staffKind
        : undefined;
    return jsonOk(await listPractitioners(kind));
  } catch (err) {
    return handleRouteError(err);
  }
}

/** v3 clean cutover — practitioner hire only via CP Workforce (Plan E). */
export async function POST() {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;

    return jsonError(
      "Hire practitioners in ERA Workspace → Workforce (Security Admin / Employments). SatAdmin can edit specialty and slot duration only.",
      403,
      { code: "WORKFORCE_HIRE_VIA_CP" },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
