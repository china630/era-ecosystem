import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/domain/settings/settings.service";

export type CatalogFavoritesMode = "first" | "only";

export function normalizeFavoritesMode(value: string | null | undefined): CatalogFavoritesMode {
  return value === "only" ? "only" : "first";
}

export async function getCatalogFavorites() {
  const tenant = await getDefaultTenant();
  return {
    keys: tenant.catalogFavoriteCodes ?? [],
    mode: normalizeFavoritesMode(tenant.catalogFavoritesMode),
  };
}

export async function updateCatalogFavorites(input: {
  keys?: string[];
  mode?: CatalogFavoritesMode;
}) {
  const tenant = await getDefaultTenant();
  const keys = input.keys?.map((k) => k.trim()).filter(Boolean);
  const unique = keys ? [...new Set(keys)] : undefined;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(unique ? { catalogFavoriteCodes: unique } : {}),
      ...(input.mode ? { catalogFavoritesMode: input.mode } : {}),
    },
  });

  return getCatalogFavorites();
}
