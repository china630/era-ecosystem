import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  revenueCode: z.string().max(32).nullable(),
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
    const existing = await prisma.outlet.findUnique({ where: { id } });
    if (!existing) return jsonError("Outlet not found", 404);
    const row = await prisma.outlet.update({
      where: { id },
      data: { revenueCode: body.revenueCode?.trim() || null },
    });
    return jsonOk({ id: row.id, code: row.code, name: row.name, revenueCode: row.revenueCode });
  } catch (err) {
    return handleRouteError(err);
  }
}
