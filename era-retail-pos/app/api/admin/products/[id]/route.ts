import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  revenueCode: z.string().max(32).nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const existing = await prisma.productCache.findUnique({ where: { id } });
    if (!existing) return jsonError("Product not found", 404);
    const row = await prisma.productCache.update({
      where: { id },
      data: {
        ...(body.revenueCode !== undefined ? { revenueCode: body.revenueCode?.trim() || null } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      },
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
