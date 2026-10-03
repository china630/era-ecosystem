import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { allowedFnbPresets, fnbKitchenOn } from "@/lib/fnb-edition";

export async function GET() {
  try {
    await assertFnbEntitled();
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
