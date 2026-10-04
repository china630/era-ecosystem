import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

type CatalogItem = { code: string; description: string; amount: number };

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
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    const items = await fetchFinanceCatalog();
    if (items.length === 0) {
      return jsonOk({ synced: 0, source: "unavailable" });
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

    return jsonOk({ synced: items.length, source: "finance" });
  } catch (err) {
    return handleRouteError(err);
  }
}
