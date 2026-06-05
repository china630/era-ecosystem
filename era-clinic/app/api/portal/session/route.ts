import { NextResponse } from "next/server";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const identity = await verifyGuestQrToken(token);
  if (!identity?.globalPersonId) {
    return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
  }

  const patients = await prisma.patientRef.findMany({
    where: { globalPersonId: identity.globalPersonId },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);
  if (patientIds.length === 0) {
    return NextResponse.json({ token, globalPersonId: identity.globalPersonId, visits: [] });
  }

  const visits = await prisma.visit.findMany({
    where: { patientRefId: { in: patientIds } },
    include: { patientRef: true, serviceLines: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    token,
    globalPersonId: identity.globalPersonId,
    expiresAt: identity.expiresAt,
    visits,
  });
}
