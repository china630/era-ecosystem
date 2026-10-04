import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.menuCategory.findUnique({ where: { id } });
    if (!existing) return jsonError("Category not found", 404);

    const code = body.code?.toUpperCase();
    if (code) {
      const codeTaken = await prisma.menuCategory.findFirst({
        where: { outletId: existing.outletId, code, NOT: { id } },
      });
      if (codeTaken) return jsonError("Category code already exists", 409);
    }
    const category = await prisma.menuCategory.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
        ...(code ? { code } : {}),
      },
    });
    return jsonOk(category);
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
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const { id } = await params;
    const existing = await prisma.menuCategory.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) return jsonError("Category not found", 404);
    if (existing._count.items > 0) {
      return jsonError("Category has items — move or deactivate them first", 400);
    }

    await prisma.menuCategory.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
