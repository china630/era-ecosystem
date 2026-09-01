import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  durationDays: z.number().int().positive(),
  procedures: z
    .array(
      z.object({
        procedureCode: z.string(),
        procedureName: z.string(),
        quotaTotal: z.number().int().positive(),
        avoidAfterHour: z.number().int().optional(),
      }),
    )
    .default([]),
  knots: z
    .array(
      z.object({
        nights: z.number().int().positive(),
        procedureCode: z.string().min(1),
        qty: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const rows = await prisma.programTemplate.findMany({
      orderBy: { code: "asc" },
      include: { procedures: true, quotaKnots: true },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await prisma.programTemplate.create({
      data: {
        code: body.code,
        name: body.name,
        durationDays: body.durationDays,
        procedures: { create: body.procedures },
        ...(body.knots?.length
          ? {
              quotaKnots: {
                create: body.knots.map((k) => ({
                  nights: k.nights,
                  procedureCode: k.procedureCode,
                  qty: k.qty,
                })),
              },
            }
          : {}),
      },
      include: { procedures: true, quotaKnots: true },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonOk({ error: "id required" }, 400);
    await prisma.programTemplate.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
