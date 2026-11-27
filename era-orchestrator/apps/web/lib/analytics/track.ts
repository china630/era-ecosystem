export type TrackParams = Record<string, string | number | boolean | undefined>;

/** Vendor-neutral analytics hook — GTM/dataLayer when present, else dev console. Server: no-op. */
export function track(event: string, params?: TrackParams): void {
  if (typeof window === "undefined") return;
  const payload = { event, ...(params ?? {}) };
  const dl = (window as Window & { dataLayer?: unknown[] }).dataLayer;
  if (Array.isArray(dl)) {
    dl.push(payload);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[track]", payload);
  }
}