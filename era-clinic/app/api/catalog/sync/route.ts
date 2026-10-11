import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

type CatalogItem = { code: string; description: string; amount: number };

async function pushClinicServices(): Promise<number> {
  const base = (
    process.env.ERA_FINANCE_API_URL ??
    process.env.FINANCE_API_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
  const token =
    process.env.FINANCE_SERVICE_TOKEN ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const procedures = await prisma.procedureType.findMany({
    select: { id: true, code: true, name: true, financeSku: true },
  });
  const diagnostics = await prisma.diagnosticService.findMany({
    select: { id: true, code: true, titleEn: true, financeSku: true },
  });
  const services = [
    ...procedures.map((row) => ({ code: row.code, name: row.name, amount: 0 })),
    ...diagnostics.map((row) => ({ code: row.code, name: row.titleEn, amount: 0 })),
  ];
  if (services.length === 0) return 0;
  const res = await fetch(`${base}/api/industry-handoffs/clinic-service-catalog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-organization-id": requestOrganizationId(),
    },
    body: JSON.stringify({ services }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!res?.ok) return 0;
  const body = (await res.json()) as { items?: Array<{ code: string; sku: string }> };
  for (const item of body.items ?? []) {
    await prisma.procedureType.updateMany({
      where: { code: item.code, financeSku: null },
      data: { financeSku: item.sku },
    });
    await prisma.diagnosticService.updateMany({
      where: { code: item.code, financeSku: null },
      data: { financeSku: item.sku },
    });
  }
  return body.items?.length ?? 0;
}

async function fetchFinanceCatalog(): Promise<CatalogItem[]> {
  const base = (
    process.env.ERA_FINANCE_API_URL ??
    process.env.FINANCE_API_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
  const token =
    process.env.FINANCE_SERVICE_TOKEN ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const res = await fetch(`${base}/api/industry-handoffs/clinic-service-catalog`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-organization-id": requestOrganizationId(),
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json()) as { items?: CatalogItem[] };
  return data.items ?? [];
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const pushed = await pushClinicServices();
    const items = await fetchFinanceCatalog();
    if (items.length === 0) {
      return jsonOk({ synced: 0, pushed, source: "unavailable" });
    }

    const organizationId = requestOrganizationId();
    for (const item of items) {
      const listAmount = item.amount > 0 ? item.amount : null;
      await prisma.serviceCatalogCache.upsert({
        where: { organizationId_code: { organizationId, code: item.code } },
        create: {
          organizationId,
          code: item.code,
          description: item.description,
          amount: item.amount,
          listAmount,
        },
        update: {
          description: item.description,
          amount: item.amount,
          listAmount,
          syncedAt: new Date(),
        },
      });
      await recordCatalogPriceIfChanged({
        organizationId,
        code: item.code,
        amount: item.amount,
        listAmount,
      });
    }

    return jsonOk({ synced: items.length, pushed, source: "finance" });
  } catch (err) {
    return handleRouteError(err);
  }
}
