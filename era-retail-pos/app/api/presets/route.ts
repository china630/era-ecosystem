import { jsonOk, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { RETAIL_PRESET_CONFIG, RETAIL_PRESETS } from "@/lib/retail-preset";

export async function GET() {
  try {
    await assertRetailEntitled();
    return jsonOk({
      presets: RETAIL_PRESETS,
      config: RETAIL_PRESET_CONFIG,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
