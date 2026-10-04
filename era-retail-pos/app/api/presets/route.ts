import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { RETAIL_PRESET_CONFIG, RETAIL_PRESETS } from "@/lib/retail-preset";

export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    return jsonOk({
      presets: RETAIL_PRESETS,
      config: RETAIL_PRESET_CONFIG,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
