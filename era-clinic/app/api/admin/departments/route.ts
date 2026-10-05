import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listServiceDepartments } from "@/domain/catalog/service-department.service";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

const createSchema = z.object({
  code: z.string().min(1),
  nameAz: z.string().optional().nullable(),
  nameRu: z.string().optional().nullable(),
  nameEn: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const rows = await listServiceDepartments();
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
    const row = await prisma.serviceDepartment.create({
      data: {
        organizationId: requestOrganizationId(),
        code: body.code.trim().toUpperCase(),
        nameAz: body.nameAz?.trim() || null,
        nameRu: body.nameRu?.trim() || null,
        nameEn: body.nameEn?.trim() || null,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
