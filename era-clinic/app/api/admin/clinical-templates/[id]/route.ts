import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  specialty: z.string().nullable().optional(),
  bodyJson: z.string().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const row = await prisma.clinicalTemplate.update({ where: { id }, data: body });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
