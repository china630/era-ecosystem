import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const items = await prisma.menuItem.findMany({
      where: { organizationId: requestOrganizationId() },
      include: {
        category: { select: { name: true } },
        priceHistory: { orderBy: { effectiveFrom: "desc" } },
      },
      orderBy: { name: "asc" },
    });

    const rows: Array<Record<string, unknown>> = [];
    for (const item of items) {
      if (item.priceHistory.length === 0) {
        rows.push({
          plu: item.plu,
          name: item.name,
          category: item.category.name,
          priceAzn: Number(item.priceAzn),
          effectiveFrom: "",
          effectiveTo: "",
          reason: "current",
        });
        continue;
      }
      for (const h of item.priceHistory) {
        rows.push({
          plu: item.plu,
          name: item.name,
          category: item.category.name,
          priceAzn: Number(h.priceAzn),
          effectiveFrom: h.effectiveFrom.toISOString(),
          effectiveTo: h.effectiveTo ? h.effectiveTo.toISOString() : "",
          reason: h.reason ?? "",
        });
      }
    }

    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "menu");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(Uint8Array.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="era-kafe-menu.xlsx"',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
