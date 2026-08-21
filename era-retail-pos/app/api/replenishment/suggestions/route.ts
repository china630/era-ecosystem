import { financeReplenishmentSuggestions } from "@era/satellite-kit";
import { jsonOk, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    await assertRetailEntitled();
    const result = await financeReplenishmentSuggestions({
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
