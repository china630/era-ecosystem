import { z } from "zod";
import { ServiceCatalogKind } from "@prisma/client";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { resolveDepartmentWrite } from "@/domain/catalog/service-department.service";
import { parseCatalogKindQuery } from "@/domain/catalog/service-catalog-kind";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDayBounds } from "@era/satellite-kit/time";
import type { Prisma } from "@prisma/client";

const writeSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  descriptionAz: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  department: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  kind: z.nativeEnum(ServiceCatalogKind).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const kinds = parseCatalogKindQuery(url.searchParams.get("kind"));
    const missingListPrice = url.searchParams.get("missingListPrice") === "1";

    const where: Prisma.ServiceCatalogCacheWhereInput = {};
    if (kinds) where.kind = { in: kinds };
    if (missingListPrice) {
      where.AND = [
        { amount: 0 },
        { OR: [{ listAmount: null }, { listAmount: 0 }] },
      ];
    }

    const rows = await prisma.serviceCatalogCache.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { code: "asc" },
    });
    const prices = await prisma.serviceCatalogPrice.findMany({
      orderBy: { effectiveFrom: "desc" },
      select: { code: true, effectiveFrom: true },
    });
    const effectiveFrom = new Map<string, string>();
    for (const price of prices) {
      if (!effectiveFrom.has(price.code)) {
        effectiveFrom.set(price.code, price.effectiveFrom.toISOString());
      }
    }
    return jsonOk(
      rows.map((row) => ({
        ...row,
        effectiveFrom: effectiveFrom.get(row.code) ?? row.syncedAt.toISOString(),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = writeSchema.parse(await req.json());
    const organizationId = requestOrganizationId();
    const code = body.code.trim();
    const existing = await prisma.serviceCatalogCache.findFirst({ where: { code } });
    if (existing) return jsonError("Code already exists", 409);
    const listAmount = body.amount > 0 ? body.amount : null;
    const effectiveFrom = body.effectiveFrom
      ? bakuDayBounds(body.effectiveFrom).start
      : new Date();
    const dept = await resolveDepartmentWrite(organizationId, body);
    const row = await prisma.serviceCatalogCache.create({
      data: {
        organizationId,
        code,
        description: body.description.trim(),
        descriptionAz: body.descriptionAz?.trim() || null,
        descriptionRu: body.descriptionRu?.trim() || null,
        descriptionEn: body.descriptionEn?.trim() || null,
        amount: body.amount,
        listAmount,
        packageIncluded: false,
        department: dept.department,
        departmentCode: dept.departmentCode,
        kind: body.kind ?? "OTHER",
        syncedAt: new Date(),
      },
    });
    await recordCatalogPriceIfChanged({
      organizationId,
      code,
      amount: body.amount,
      listAmount,
      effectiveFrom,
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
