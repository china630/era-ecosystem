import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { departmentFallbackLabel } from "@/domain/catalog/service-department.service";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  nameAz: z.string().optional().nullable(),
  nameRu: z.string().optional().nullable(),
  nameEn: z.string().optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const existing = await prisma.serviceDepartment.findFirst({ where: { id } });
    if (!existing) return jsonError("Not found", 404);
    const body = patchSchema.parse(await req.json());
    const row = await prisma.serviceDepartment.update({
      where: { id },
      data: {
        ...(body.code != null ? { code: body.code.trim().toUpperCase() } : {}),
        ...(body.nameAz !== undefined ? { nameAz: body.nameAz?.trim() || null } : {}),
        ...(body.nameRu !== undefined ? { nameRu: body.nameRu?.trim() || null } : {}),
        ...(body.nameEn !== undefined ? { nameEn: body.nameEn?.trim() || null } : {}),
      },
    });
    const label = departmentFallbackLabel(row);
    await prisma.serviceCatalogCache.updateMany({
      where: { departmentCode: row.code },
      data: { department: label },
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
