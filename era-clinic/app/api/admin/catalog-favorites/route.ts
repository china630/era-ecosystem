import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRead, assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  getCatalogFavorites,
  updateCatalogFavorites,
} from "@/domain/catalog/catalog-favorites.service";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";

const patchSchema = z.object({
  keys: z.array(z.string()).optional(),
  mode: z.enum(["first", "only"]).optional(),
});

export async function GET() {
  try {
    const guard = await assertClinicAdminRead();
    if (guard.error) return guard.error;
    const favorites = await getCatalogFavorites();
    const catalog = await getDiagnosticCatalog();
    return jsonOk({
      ...favorites,
      groups: catalog.groups,
      items: catalog.items.map((i) => ({
        code: i.code,
        kind: i.kind,
        modality: i.modality,
        category: i.category,
        title: i.title,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = patchSchema.parse(await req.json());
    const favorites = await updateCatalogFavorites(body);
    return jsonOk(favorites);
  } catch (err) {
    return handleRouteError(err);
  }
}
