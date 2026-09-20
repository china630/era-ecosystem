import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";

export async function GET() {
  try {
    await assertFnbEntitled();
    const profile = await getFnbOrgProfile();
    return jsonOk({
      edition: profile.edition,
      hotelMode: profile.hotelMode,
      waiterPinPacks: profile.waiterPinPacks,
      activeModules: profile.activeModules,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
