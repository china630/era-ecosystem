import { financeReplenishmentSuggestions } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    const result = await financeReplenishmentSuggestions({
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
