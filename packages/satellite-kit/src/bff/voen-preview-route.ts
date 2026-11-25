import { z } from "zod";
import { platformVoenLookup } from "../integration/platform-catalog.client";
import type { FinanceVoenLookupResult } from "../integration/finance-handoffs.client";

/** Parse a VÖEN and resolve it via the orchestrator platform catalog (DH-006). */
export async function fetchVoenPreview(voenRaw: string): Promise<FinanceVoenLookupResult> {
  const voen = voenRaw.replace(/\D/g, "");
  z.string().length(10).parse(voen);
  return platformVoenLookup(voen);
}

/** Parse `?voen=` and resolve via orchestrator platform catalog gateway (DH-006). */
export async function fetchVoenPreviewFromRequest(
  req: Request,
): Promise<FinanceVoenLookupResult> {
  const url = new URL(req.url);
  return fetchVoenPreview(url.searchParams.get("voen") ?? "");
}
