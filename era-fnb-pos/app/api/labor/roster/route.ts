import { assertFnbEntitled, handleRouteError, jsonError } from "@/lib/api-utils";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashStaffPin } from "@/lib/labor-pin";
import { requestOrganizationId } from "@/lib/request-organization";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { getSessionFromRequest } from "@/lib/session";
import {
  denyUnlessAnyPermission,
} from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ROSTER_WRITE } from "@/lib/auth/read-permission-sets";

export async function GET(req: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(req);
  const denied = denyUnlessAnyPermission(session, [
    PERMISSIONS.LABOR_ROSTER_READ,
    PERMISSIONS.STAFF_PIN,
    PERMISSIONS.LABOR_ROSTER_WRITE,
  ]);
  if (denied) return denied;
  const roster = await prisma.staffRoster.findMany({
    where: { active: true },
    select: {
      id: true,
      staffCode: true,
      fullName: true,
      pinRole: true,
      outletId: true,
      globalPersonId: true,
    },
  });
  return NextResponse.json({ roster });
}

const bodySchema = z.object({
  staffCode: z.string(),
  fullName: z.string(),
  pin: z.string().min(4).max(8),
  pinRole: z.enum(["CASHIER", "WAITER", "KITCHEN", "MANAGER"]).default("CASHIER"),
  outletId: z.string().min(1),
  globalPersonId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(req);
    const denied = denyUnlessAnyPermission(session, ROSTER_WRITE);
    if (denied) return denied;
    const body = bodySchema.parse(await req.json());
    const organizationId = requestOrganizationId();
    const profile = await getFnbOrgProfile(organizationId);
    const kafe = profile.edition.toLowerCase() === "kafe";
    if (!body.globalPersonId && !kafe) {
      return jsonError(
        "Manual roster create requires globalPersonId from Finance HR STAFF_PROVISIONED",
        422,
      );
    }
    if (body.pinRole === "WAITER") {
      await requireFnbSubmodule("fnb_waiter_pin", organizationId);
      const waiters = await prisma.staffRoster.count({
        where: { organizationId, active: true, pinRole: "WAITER" },
      });
      const cap = Math.max(0, profile.waiterPinPacks) * 5;
      if (waiters >= cap) {
        return jsonError(
          `Waiter PIN pack full (${cap}). Buy another +19 pack.`,
          402,
        );
      }
    }
    const row = await prisma.staffRoster.upsert({
      where: {
        organizationId_staffCode: { organizationId, staffCode: body.staffCode },
      },
      create: {
        organizationId,
        staffCode: body.staffCode,
        fullName: body.fullName,
        pinHash: hashStaffPin(body.pin),
        pinRole: body.pinRole,
        outletId: body.outletId,
        globalPersonId: body.globalPersonId,
      },
      update: {
        fullName: body.fullName,
        pinHash: hashStaffPin(body.pin),
        pinRole: body.pinRole,
        outletId: body.outletId,
        globalPersonId: body.globalPersonId,
        active: true,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
