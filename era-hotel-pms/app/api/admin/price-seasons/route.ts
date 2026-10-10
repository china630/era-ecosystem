import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { serialize } from "@/lib/serialize";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertMasterDataRead } from "@/lib/auth/master-data-guard";
import { listPriceSeasons } from "@/lib/services/price-season.service";

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listPriceSeasons()));
  } catch (err) {
    return handleRouteError(err);
  }
}
