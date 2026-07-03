import { fetchVoenPreviewFromRequest } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    const result = await fetchVoenPreviewFromRequest(req);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
