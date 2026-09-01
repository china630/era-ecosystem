import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  minNights: z.number().int().positive().nullable().optional(),
  maxNights: z.number().int().positive().nullable().optional(),
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
  knots: z
    .array(
      z.object({
        nights: z.number().int().positive(),
        procedureCode: z.string(),
        qty: z.number().int().nonnegative(),
      }),
    )
    .optional(),
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
      if (body.knots) {
        await tx.programTemplateQuotaKnot.deleteMany({ where: { templateId: id } });
        if (body.knots.length > 0) {
          await tx.programTemplateQuotaKnot.createMany({
            data: body.knots.map((k) => ({
              templateId: id,
              nights: k.nights,
              procedureCode: k.procedureCode,
              qty: k.qty,
            })),
          });
        }
      }
      return tx.programTemplate.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.durationDays ? { durationDays: body.durationDays } : {}),
          ...(body.minNights !== undefined ? { minNights: body.minNights } : {}),
          ...(body.maxNights !== undefined ? { maxNights: body.maxNights } : {}),
        },
        include: { procedures: true, quotaKnots: true },
      });
    });

    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
