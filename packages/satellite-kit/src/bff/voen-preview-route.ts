import { z } from "zod";
import { platformVoenLookup } from "../integration/platform-catalog.client";
import type { FinanceVoenLookupResult } from "../integration/finance-handoffs.client";

/** Parse `?voen=` and resolve via orchestrator platform catalog gateway (DH-006). */
export async function fetchVoenPreviewFromRequest(
  req: Request,
): Promise<FinanceVoenLookupResult> {
  const url = new URL(req.url);
  const voen = (url.searchParams.get("voen") ?? "").replace(/\D/g, "");
  z.string().length(10).parse(voen);
  return platformVoenLookup(voen);
}
