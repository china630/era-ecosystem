import { handleRouteError, jsonError, jsonOk, requireCustomerSession } from "@/lib/api-utils";
import { revokeCorporateApiKey } from "@/lib/open-api-keys";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    if (auth.session.channel !== "CORPORATE") {
      return jsonError("Corporate channel required", 403);
    }
    const { id } = await context.params;
    const row = await revokeCorporateApiKey(id, auth.session.customerId);
    if (!row) return jsonError("API key not found", 404);
    return jsonOk({ id: row.id, status: row.status });
  } catch (err) {
    return handleRouteError(err);
  }
}
