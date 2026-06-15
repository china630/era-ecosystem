import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
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
});

export async function GET() {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const rows = await prisma.programTemplate.findMany({
      orderBy: { code: "asc" },
      include: { procedures: true },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await prisma.programTemplate.create({
      data: {
        code: body.code,
        name: body.name,
        durationDays: body.durationDays,
        procedures: { create: body.procedures },
      },
      include: { procedures: true },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonOk({ error: "id required" }, 400);
    await prisma.programTemplate.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
