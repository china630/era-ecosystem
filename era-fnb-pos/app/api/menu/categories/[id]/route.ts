import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.menuCategory.findUnique({ where: { id } });
    if (!existing) return jsonError("Category not found", 404);

    const category = await prisma.menuCategory.update({
      where: { id },
      data: body,
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
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(_request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
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
