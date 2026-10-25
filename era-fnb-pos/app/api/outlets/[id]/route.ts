import { handleRouteError, jsonError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const patchSchema = z.object({
  revenueCenterCode: z.string().min(1).max(32),
  financeWarehouseCode: z.string().max(64).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.HOTEL_REVENUE_CODES);
    if (denied) return denied;
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.outlet.findUnique({ where: { id } });
    if (!existing) return jsonError("Outlet not found", 404);
    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        revenueCenterCode: body.revenueCenterCode.trim(),
        ...(body.financeWarehouseCode !== undefined
          ? { financeWarehouseCode: body.financeWarehouseCode?.trim() || null }
          : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
