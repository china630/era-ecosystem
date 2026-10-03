import { z } from "zod";
import { assertFnbEntitled, handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbOrgProfile, setFnbEnabledPresets } from "@/lib/fnb-org-profile";
import {
  FNB_PRESETS,
  FNB_SELECTABLE_PRESETS,
  allowedFnbPresets,
} from "@/lib/fnb-edition";

function selectable(edition: Parameters<typeof allowedFnbPresets>[0]) {
  return allowedFnbPresets(edition).filter((p) => FNB_SELECTABLE_PRESETS.includes(p));
}

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const profile = await getFnbOrgProfile();
    return jsonOk({
      edition: profile.edition,
      enabledPresets: profile.enabledPresets,
      selectablePresets: selectable(profile.edition),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchSchema = z.object({
  enabledPresets: z.array(z.enum(FNB_PRESETS)).min(1).max(FNB_PRESETS.length),
});

export async function PATCH(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const body = patchSchema.parse(await request.json());
    const profile = await getFnbOrgProfile();
    const allowed = allowedFnbPresets(profile.edition);
    const outside = body.enabledPresets.filter((p) => !allowed.includes(p));
    if (outside.length > 0) {
      return jsonError(`FNB_PRESET_NOT_IN_EDITION: ${outside.join(", ")}`, 403);
    }
    const shown = selectable(profile.edition);
    const kept = profile.enabledPresets.filter((p) => !shown.includes(p));
    const next = await setFnbEnabledPresets([...body.enabledPresets, ...kept]);
    return jsonOk({
      edition: next.edition,
      enabledPresets: next.enabledPresets,
      selectablePresets: selectable(next.edition),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
