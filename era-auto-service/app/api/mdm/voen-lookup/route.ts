import { lookupLegalEntityByVoen } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    const taxId = new URL(req.url).searchParams.get("taxId")?.trim();
    if (!taxId) {
      return jsonOk({ financeCounterpartyId: null, error: "taxId required" }, 400);
    }
    const result = await lookupLegalEntityByVoen(taxId);
    return jsonOk({
      financeCounterpartyId: result.globalLegalEntityId ?? result.organizationId,
      organizationId: result.organizationId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
