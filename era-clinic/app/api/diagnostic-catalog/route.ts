import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import {
  filterAndSortCatalogItems,
  getDiagnosticCatalog,
} from "@/domain/catalog/diagnostic-catalog";
import { getCatalogFavorites } from "@/domain/catalog/catalog-favorites.service";

const querySchema = z.object({
  kinds: z.string().optional(),
  search: z.string().optional(),
  applyFavorites: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const query = querySchema.parse({
      kinds: url.searchParams.get("kinds") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      applyFavorites: url.searchParams.get("applyFavorites") ?? undefined,
    });

    const catalog = await getDiagnosticCatalog();
    const favorites = await getCatalogFavorites();
    const kinds = query.kinds
      ? query.kinds.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;

    const items = query.applyFavorites
      ? filterAndSortCatalogItems(catalog.items, favorites.keys, favorites.mode, {
          kinds,
          search: query.search,
        })
      : filterAndSortCatalogItems(catalog.items, [], "first", {
          kinds,
          search: query.search,
        });

    return jsonOk({
      version: catalog.version,
      metaFields: catalog.metaFields,
      groups: catalog.groups,
      items,
      favorites,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
