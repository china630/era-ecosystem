import { NextResponse } from "next/server";
import { verifyGuestIdentityToken, verifyGuestQrToken } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";

async function resolvePortalIdentity(token: string) {
  const viaOrchestrator = await verifyGuestQrToken(token);
  if (viaOrchestrator?.globalPersonId) {
    if (viaOrchestrator.expiresAt < Math.floor(Date.now() / 1000)) {
      return { error: "token expired" as const, status: 410 as const };
    }
    return { identity: viaOrchestrator };
  }

  const local = verifyGuestIdentityToken(token);
  if (local?.globalPersonId) {
    if (local.expiresAt && local.expiresAt < Math.floor(Date.now() / 1000)) {
      return { error: "token expired" as const, status: 410 as const };
    }
    return { identity: local };
  }

  return { error: "invalid or expired token" as const, status: 401 as const };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const resolved = await resolvePortalIdentity(token);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { identity } = resolved;
  const patients = await prisma.patientRef.findMany({
    where: { globalPersonId: identity.globalPersonId },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);
  if (patientIds.length === 0) {
    return NextResponse.json({
      globalPersonId: identity.globalPersonId,
      expiresAt: identity.expiresAt,
      labResults: [],
    });
  }

  const labResults = await prisma.labOrder.findMany({
    where: {
      patientRefId: { in: patientIds },
      status: "COMPLETED",
      publishedAt: { not: null },
    },
    select: {
      id: true,
      testCode: true,
      status: true,
      completedAt: true,
      publishedAt: true,
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });

  await recordClinicAudit(
    { request },
    "portal",
    identity.globalPersonId,
    "PORTAL_ACCESS",
    { labCount: labResults.length },
  );

  return NextResponse.json({
    globalPersonId: identity.globalPersonId,
    expiresAt: identity.expiresAt,
    labResults,
  });
}
