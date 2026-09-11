import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { SatelliteSessionPayload } from "@era/satellite-kit";
import { hasClinicPermissionBypass } from "@/lib/auth/clinic-admin-access";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import {
  CLINIC_PERMISSION,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export type ClinicDataScopeMode = "ALL" | "ASSIGNED";

export type ResolvedClinicDataScope = {
  mode: ClinicDataScopeMode;
  practitionerId: string | null;
};

/**
 * Layer 2 (data scope): after screen/API permission passes.
 * `scope:*.all` (or OrgOwner / platform bypass) → ALL rows;
 * otherwise → ASSIGNED to session practitioner (empty if no Practitioner link).
 */
export async function resolveClinicDataScope(
  session: SatelliteSessionPayload,
  allPermission: ClinicPermission,
): Promise<ResolvedClinicDataScope> {
  const practitioner = await prisma.practitioner.findFirst({
    where: { userId: session.sub },
    select: { id: true },
  });
  const practitionerId = practitioner?.id ?? null;

  if (hasClinicPermissionBypass(session)) {
    return { mode: "ALL", practitionerId };
  }

  const perms = await permissionsForUser(session.sub);
  if (
    sessionHasClinicPermission(
      { ...session, permissions: perms },
      allPermission,
    )
  ) {
    return { mode: "ALL", practitionerId };
  }

  return { mode: "ASSIGNED", practitionerId };
}

/** Episode assigned when practitioner is on the CLI-56 care team (strict). */
export function episodeAssignedToPractitionerWhere(
  practitionerId: string,
): Prisma.ClinicalEpisodeWhereInput {
  return {
    careDoctors: { some: { practitionerId } },
  };
}

/** Lab on own visit, or on an episode the practitioner is assigned to. */
export function labOrderAssignedToPractitionerWhere(
  practitionerId: string,
): Prisma.LabOrderWhereInput {
  return {
    OR: [
      { visit: { is: { practitionerId } } },
      {
        episode: {
          is: episodeAssignedToPractitionerWhere(practitionerId),
        },
      },
    ],
  };
}

export async function assertEpisodeDataScope(
  session: SatelliteSessionPayload,
  episodeId: string,
): Promise<NextResponse | null> {
  const scope = await resolveClinicDataScope(
    session,
    CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
  );
  if (scope.mode === "ALL") return null;
  if (!scope.practitionerId) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  const hit = await prisma.clinicalEpisode.findFirst({
    where: {
      AND: [
        { id: episodeId },
        episodeAssignedToPractitionerWhere(scope.practitionerId),
      ],
    },
    select: { id: true },
  });
  if (!hit) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  return null;
}

export async function assertLabOrderDataScope(
  session: SatelliteSessionPayload,
  labOrderId: string,
): Promise<NextResponse | null> {
  const scope = await resolveClinicDataScope(
    session,
    CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL,
  );
  if (scope.mode === "ALL") return null;
  if (!scope.practitionerId) {
    return NextResponse.json({ error: "Lab order not found" }, { status: 404 });
  }
  const hit = await prisma.labOrder.findFirst({
    where: {
      AND: [
        { id: labOrderId },
        labOrderAssignedToPractitionerWhere(scope.practitionerId),
      ],
    },
    select: { id: true },
  });
  if (!hit) {
    return NextResponse.json({ error: "Lab order not found" }, { status: 404 });
  }
  return null;
}
