import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  active: z.boolean(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const row = await prisma.labBlankProfile.findUnique({ where: { id }, select: { id: true } });
    if (!row) return jsonError("Not found", 404);
    await prisma.labBlankProfile.update({ where: { id }, data: { active: body.active } });
    return jsonOk({ id, active: body.active });
  } catch (err) {
    return handleRouteError(err);
  }
}
