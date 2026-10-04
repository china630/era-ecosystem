import { handleRouteError, jsonOk, jsonError } from "@/lib/api-utils";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { allowedFnbPresets, fnbKitchenOn } from "@/lib/fnb-edition";
import { getSatelliteSession } from "@/lib/session";

export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const profile = await getFnbOrgProfile();
    return jsonOk({
      edition: profile.edition,
      hotelMode: profile.hotelMode,
      enabledPresets: profile.enabledPresets,
      allowedPresets: allowedFnbPresets(profile.edition),
      kitchen: fnbKitchenOn(profile),
      waiterPinPacks: profile.waiterPinPacks,
      activeModules: profile.activeModules,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
