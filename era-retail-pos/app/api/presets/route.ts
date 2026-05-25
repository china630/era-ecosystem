import { jsonOk } from "@/lib/api-utils";
import { RETAIL_PRESET_CONFIG, RETAIL_PRESETS } from "@/lib/retail-preset";

export async function GET() {
  return jsonOk({
    presets: RETAIL_PRESETS,
    config: RETAIL_PRESET_CONFIG,
  });
}
