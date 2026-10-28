import { handleRouteError, jsonError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  revenueCenterCode: z.string().min(1).max(32).optional(),
  financeWarehouseCode: z.string().max(64).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.OUTLETS_MANAGE,
      PERMISSIONS.HOTEL_REVENUE_CODES,
    ]);
    if (denied) return denied;
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    if (!session) return jsonError("Unauthorized", 401);
    const canManage = sessionHasFnbPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    const canRevenue = sessionHasFnbPermission(session, PERMISSIONS.HOTEL_REVENUE_CODES);
    if (body.name !== undefined && !canManage) {
      return jsonError("Outlet name requires outlets.manage", 403);
    }
    if (body.active !== undefined && !canManage) {
      return jsonError("Outlet active flag requires outlets.manage", 403);
    }
    if (
      (body.revenueCenterCode !== undefined || body.financeWarehouseCode !== undefined) &&
      !canRevenue &&
      !canManage
    ) {
      return jsonError("Revenue mapping requires hotel.revenue_codes or outlets.manage", 403);
    }
    const existing = await prisma.outlet.findUnique({ where: { id } });
    if (!existing) return jsonError("Outlet not found", 404);
    if (
      body.revenueCenterCode === undefined &&
      body.financeWarehouseCode === undefined &&
      body.name === undefined &&
      body.active === undefined
    ) {
      return jsonError("No fields to update", 400);
    }
    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.revenueCenterCode !== undefined
          ? { revenueCenterCode: body.revenueCenterCode.trim() }
          : {}),
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
