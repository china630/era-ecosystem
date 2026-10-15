import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  revenueCode: z.string().max(32).nullable().optional(),
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
    const existing = await prisma.productCategory.findUnique({ where: { id } });
    if (!existing) return jsonError("Category not found", 404);
    const row = await prisma.productCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.revenueCode !== undefined ? { revenueCode: body.revenueCode?.trim() || null } : {}),
      },
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
