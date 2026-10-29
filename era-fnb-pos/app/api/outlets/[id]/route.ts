import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";

const optionalContact = z.string().max(200).nullable().optional();

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(1).max(32).optional(),
  revenueCenterCode: z.string().min(1).max(32).nullable().optional(),
  financeWarehouseCode: z.string().max(64).nullable().optional(),
  active: z.boolean().optional(),
  capTill: z.boolean().optional(),
  capTables: z.boolean().optional(),
  capBuffetPlanner: z.boolean().optional(),
  shapeHint: z.enum(["cafe", "restaurant", "buffet_kitchen", "disco"]).nullable().optional(),
  phone: optionalContact,
  email: optionalContact,
  address: optionalContact,
  website: optionalContact,
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
    if (
      (body.name !== undefined ||
        body.code !== undefined ||
        body.capTill !== undefined ||
        body.capTables !== undefined ||
        body.capBuffetPlanner !== undefined ||
        body.shapeHint !== undefined) &&
      !canManage
    ) {
      return jsonError("Outlet profile requires outlets.manage", 403);
    }
    if (body.active !== undefined && !canManage) {
      return jsonError("Outlet active flag requires outlets.manage", 403);
    }
    if (
      (body.phone !== undefined ||
        body.email !== undefined ||
        body.address !== undefined ||
        body.website !== undefined) &&
      !canManage
    ) {
      return jsonError("Outlet contacts require outlets.manage", 403);
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
      body.code === undefined &&
      body.active === undefined &&
      body.capTill === undefined &&
      body.capTables === undefined &&
      body.capBuffetPlanner === undefined &&
      body.shapeHint === undefined &&
      body.phone === undefined &&
      body.email === undefined &&
      body.address === undefined &&
      body.website === undefined
    ) {
      return jsonError("No fields to update", 400);
    }
    if (body.code !== undefined) {
      const nextCode = body.code.trim().toUpperCase();
      if (nextCode === "RESTAURANT") {
        return jsonError("Outlet code RESTAURANT is retired — use NAFTANI", 400);
      }
    }
    const trimOrNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null || !String(v).trim() ? null : String(v).trim();
    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.capTill !== undefined ? { capTill: body.capTill } : {}),
        ...(body.capTables !== undefined ? { capTables: body.capTables } : {}),
        ...(body.capBuffetPlanner !== undefined
          ? { capBuffetPlanner: body.capBuffetPlanner }
          : {}),
        ...(body.shapeHint !== undefined ? { shapeHint: body.shapeHint } : {}),
        ...(body.revenueCenterCode !== undefined
          ? {
              revenueCenterCode:
                body.revenueCenterCode === null || !body.revenueCenterCode.trim()
                  ? "FOOD"
                  : body.revenueCenterCode.trim(),
            }
          : {}),
        ...(body.financeWarehouseCode !== undefined
          ? { financeWarehouseCode: body.financeWarehouseCode?.trim() || null }
          : {}),
        ...(body.phone !== undefined ? { phone: trimOrNull(body.phone) } : {}),
        ...(body.email !== undefined ? { email: trimOrNull(body.email) } : {}),
        ...(body.address !== undefined ? { address: trimOrNull(body.address) } : {}),
        ...(body.website !== undefined ? { website: trimOrNull(body.website) } : {}),
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessAnyPermission(session, [PERMISSIONS.OUTLETS_MANAGE]);
    if (denied) return denied;
    const { id } = await params;
    const existing = await prisma.outlet.findUnique({ where: { id } });
    if (!existing) return jsonError("Outlet not found", 404);
    const openShifts = await prisma.posShift.count({
      where: { outletId: id, status: "OPEN" },
    });
    if (openShifts > 0) {
      return jsonError("Close open shifts before deleting this outlet", 409);
    }
    await prisma.outlet.delete({ where: { id } });
    return jsonOk({ ok: true, id });
  } catch (err) {
    return handleRouteError(err);
  }
}
