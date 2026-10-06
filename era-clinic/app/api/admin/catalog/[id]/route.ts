import { z } from "zod";
import { ServiceCatalogKind } from "@prisma/client";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { resolveDepartmentWrite } from "@/domain/catalog/service-department.service";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDayBounds } from "@era/satellite-kit/time";

const patchSchema = z.object({
  description: z.string().min(1).optional(),
  descriptionAz: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional(),
  listAmount: z.number().nonnegative().nullable().optional(),
  packageIncluded: z.boolean().optional(),
  department: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  kind: z.nativeEnum(ServiceCatalogKind).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const row = await prisma.serviceCatalogCache.findFirst({ where: { id } });
    if (!row) return jsonError("Not found", 404);
    const prices = await prisma.serviceCatalogPrice.findMany({
      where: { catalogId: id },
      orderBy: { effectiveFrom: "desc" },
    });
    return jsonOk({ ...row, prices });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const existing = await prisma.serviceCatalogCache.findFirst({ where: { id } });
    if (!existing) return jsonError("Not found", 404);
    const body = patchSchema.parse(await req.json());
    const amount = body.amount ?? Number(existing.amount);
    const listAmount =
      body.listAmount !== undefined
        ? body.listAmount
        : existing.listAmount == null
          ? null
          : Number(existing.listAmount);
    const effectiveFrom = body.effectiveFrom
      ? bakuDayBounds(body.effectiveFrom).start
      : new Date();
    const dept =
      body.departmentCode !== undefined || body.department !== undefined
        ? await resolveDepartmentWrite(existing.organizationId || requestOrganizationId(), {
            departmentCode: body.departmentCode,
            department: body.department,
          })
        : null;
    const row = await prisma.serviceCatalogCache.update({
      where: { id },
      data: {
        ...(body.description != null ? { description: body.description.trim() } : {}),
        ...(body.descriptionAz !== undefined ? { descriptionAz: body.descriptionAz?.trim() || null } : {}),
        ...(body.descriptionRu !== undefined ? { descriptionRu: body.descriptionRu?.trim() || null } : {}),
        ...(body.descriptionEn !== undefined ? { descriptionEn: body.descriptionEn?.trim() || null } : {}),
        ...(body.amount != null ? { amount: body.amount } : {}),
        ...(body.listAmount !== undefined ? { listAmount: body.listAmount } : {}),
        ...(body.packageIncluded != null ? { packageIncluded: body.packageIncluded } : {}),
        ...(dept
          ? { department: dept.department, departmentCode: dept.departmentCode }
          : {}),
        ...(body.kind != null ? { kind: body.kind } : {}),
        syncedAt: new Date(),
      },
    });
    await recordCatalogPriceIfChanged({
      organizationId: existing.organizationId || requestOrganizationId(),
      code: existing.code,
      amount,
      listAmount,
      effectiveFrom,
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const existing = await prisma.serviceCatalogCache.findFirst({ where: { id } });
    if (!existing) return jsonError("Not found", 404);
    const orgId = existing.organizationId;
    const code = existing.code;
    const [procedures, visitLines, labItems, receipts, labHeaders] = await Promise.all([
      prisma.procedureOrder.count({
        where: { organizationId: orgId, procedureCode: code },
      }),
      prisma.visitServiceLine.count({
        where: { organizationId: orgId, serviceCode: code },
      }),
      prisma.labOrderItem.count({
        where: { organizationId: orgId, serviceCode: code },
      }),
      prisma.clinicReceiptLine.count({
        where: { organizationId: orgId, serviceCode: code },
      }),
      prisma.labOrder.count({
        where: {
          organizationId: orgId,
          OR: [
            { testCode: code },
            { testCode: { startsWith: `${code},` } },
            { testCode: { endsWith: `,${code}` } },
            { testCode: { contains: `,${code},` } },
          ],
        },
      }),
    ]);
    if (procedures + visitLines + labItems + receipts + labHeaders > 0) {
      return jsonError("Catalog price is referenced by orders", 409);
    }
    await prisma.serviceCatalogCache.delete({ where: { id } });
    return jsonOk({ id });
  } catch (err) {
    return handleRouteError(err);
  }
}
