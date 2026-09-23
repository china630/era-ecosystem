import { NextResponse } from "next/server";
import {
  IndustryModuleInactiveError,
  requireSatelliteModule,
  satelliteOrganizationId,
  verifyGuestIdentityToken,
  verifyGuestQrToken,
} from "@era/satellite-kit";
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
    select: { id: true, organizationId: true },
  });
  const orgIds = [
    ...new Set(patients.map((p) => p.organizationId?.trim()).filter((id): id is string => Boolean(id))),
  ];
  if (orgIds.length === 0) {
    try {
      const bound = satelliteOrganizationId();
      if (bound) orgIds.push(bound);
    } catch {
      /* SHARED without a bind — fail closed below */
    }
  }
  const entitledOrgs: string[] = [];
  for (const organizationId of orgIds) {
    try {
      await requireSatelliteModule("platform_portal", { organizationId });
      entitledOrgs.push(organizationId);
    } catch (err) {
      if (!(err instanceof IndustryModuleInactiveError)) throw err;
    }
  }
  if (entitledOrgs.length === 0) {
    return NextResponse.json({ error: "portal_module_inactive" }, { status: 403 });
  }
  const entitled = new Set(entitledOrgs);
  const patientIds = patients
    .filter((p) => entitled.has(p.organizationId))
    .map((p) => p.id);
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
