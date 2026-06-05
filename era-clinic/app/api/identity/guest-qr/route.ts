import { NextResponse } from "next/server";
import { getRouteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { issueGuestQrToken } from "@era/satellite-kit";

export async function POST(request: Request) {
  const session = await getRouteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
