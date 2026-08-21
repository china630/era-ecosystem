import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { recordMenuItemPrice } from "@/lib/menu-price-history";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  plu: z.string().min(1).optional(),
  priceAzn: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  categoryId: z.string().min(1).optional(),
  recipeSku: z.string().min(1).nullable().optional(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  priceReason: z.string().max(200).optional(),
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
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) return jsonError("Menu item not found", 404);

    const imageUrl =
      body.imageUrl === undefined
        ? undefined
        : body.imageUrl === "" || body.imageUrl === null
          ? null
          : body.imageUrl;

    const priceChanged =
      body.priceAzn !== undefined &&
      Number(body.priceAzn) !== Number(existing.priceAzn);

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.menuItem.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.plu !== undefined ? { plu: body.plu } : {}),
          ...(body.priceAzn !== undefined ? { priceAzn: body.priceAzn } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.recipeSku !== undefined ? { recipeSku: body.recipeSku } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
      });
      if (priceChanged && body.priceAzn !== undefined) {
        await recordMenuItemPrice(tx, id, body.priceAzn, {
          reason: body.priceReason ?? null,
          createdBy: session?.login ?? session?.sub ?? null,
        });
      }
      return updated;
    });

    return jsonOk(item);
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
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) return jsonError("Menu item not found", 404);

    // Soft-delete: keep PLU history for tickets
    const item = await prisma.menuItem.update({
      where: { id },
      data: { active: false },
    });
    return jsonOk(item);
  } catch (err) {
    return handleRouteError(err);
  }
}
