import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  procedures: z
    .array(
      z.object({
        procedureCode: z.string(),
        procedureName: z.string(),
        quotaTotal: z.number().int().positive(),
        avoidAfterHour: z.number().int().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());

    const row = await prisma.$transaction(async (tx) => {
      if (body.procedures) {
        await tx.programTemplateProcedure.deleteMany({ where: { templateId: id } });
        await tx.programTemplateProcedure.createMany({
          data: body.procedures.map((p) => ({
            templateId: id,
            procedureCode: p.procedureCode,
            procedureName: p.procedureName,
            quotaTotal: p.quotaTotal,
            avoidAfterHour: p.avoidAfterHour ?? null,
          })),
        });
      }
      return tx.programTemplate.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.durationDays ? { durationDays: body.durationDays } : {}),
        },
        include: { procedures: true },
      });
    });

    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
