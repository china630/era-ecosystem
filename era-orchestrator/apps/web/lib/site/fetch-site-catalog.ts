import { unstable_cache } from "next/cache";
import {
  emptySiteCatalog,
  type SiteCatalogResponse,
} from "./site-catalog-types";

function orchApiBase(): string {
  return (process.env.ORCH_API_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

async function fetchSiteCatalogRaw(locale: string): Promise<SiteCatalogResponse> {
  const url =
    typeof window === "undefined"
      ? `${orchApiBase()}/v1/public/site-catalog?locale=${encodeURIComponent(locale)}`
      : `/api/public/site-catalog?locale=${encodeURIComponent(locale)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return emptySiteCatalog();
    const body = (await res.json()) as SiteCatalogResponse;
    if (body.unavailable) return { ...emptySiteCatalog(), ...body, unavailable: true };
    return body;
  } catch {
    return emptySiteCatalog();
  }
}

export async function fetchSiteCatalog(locale: string): Promise<SiteCatalogResponse> {
  if (typeof window !== "undefined") {
    return fetchSiteCatalogRaw(locale);
  }
  const run = unstable_cache(
    async () => fetchSiteCatalogRaw(locale),
    ["site-catalog", locale],
    { revalidate: 120, tags: ["site-catalog"] },
  );
  return run();
}