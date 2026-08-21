import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

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

export async function POST() {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    let items = await fetchFinanceCatalog();
    if (items.length === 0) {
      items = [
        { code: "CONSULT", description: "Consultation", amount: 50 },
        { code: "LAB-CBC", description: "Complete blood count", amount: 25 },
        { code: "USG", description: "Ultrasound", amount: 40 },
        { code: "MASSAGE", description: "Therapeutic massage", amount: 60 },
      ];
    }

    for (const item of items) {
      await prisma.serviceCatalogCache.upsert({
        where: { code: item.code } as never,
        create: {
          code: item.code,
          description: item.description,
          amount: item.amount,
        },
        update: {
          description: item.description,
          amount: item.amount,
          syncedAt: new Date(),
        },
      });
    }

    return jsonOk({ synced: items.length, source: items.length ? "finance" : "fallback" });
  } catch (err) {
    return handleRouteError(err);
  }
}
