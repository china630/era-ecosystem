import { NextResponse } from "next/server";
import {
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import { issueGuestQrToken } from "@era/satellite-kit";

export async function POST(request: Request) {
  const session = await getRouteSession();
  const denied = await requireClinicPermission(
    session,
    CLINIC_PERMISSION.API_IDENTITY_GUEST_QR,
  );
  if (denied) return denied;

  const body = (await request.json()) as { patientRefId?: string };
  if (!body.patientRefId) {
    return NextResponse.json({ error: "patientRefId required" }, { status: 400 });
  }
  const patient = await prisma.patientRef.findUnique({
    where: { id: body.patientRefId },
  });
  if (!patient?.globalPersonId) {
    return NextResponse.json({ error: "globalPersonId not linked" }, { status: 400 });
  }
  const issued = await issueGuestQrToken(patient.globalPersonId);
  if (!issued) {
    return NextResponse.json({ error: "issue failed" }, { status: 502 });
  }
  return NextResponse.json({
    globalPersonId: patient.globalPersonId,
    ...issued,
  });
}
