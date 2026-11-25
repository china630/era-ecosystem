/** Lifted from nest/generated/settings_presets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbOrgProfile, setFnbEnabledPresets } from "@/lib/fnb-org-profile";
import { FNB_PRESETS, FNB_SELECTABLE_PRESETS, allowedFnbPresets } from "@/lib/fnb-edition";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function selectable(edition: Parameters<typeof allowedFnbPresets>[0]) {
  return allowedFnbPresets(edition).filter((p) => FNB_SELECTABLE_PRESETS.includes(p));
}



const patchSchema = z.object({
  enabledPresets: z.array(z.enum(FNB_PRESETS)).min(1).max(FNB_PRESETS.length),
});


@Controller()
export class SettingsPresetsController {
  @Get("api/settings/presets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const profile = await getFnbOrgProfile();
    return sendJson(httpRes, {
      edition: profile.edition,
      enabledPresets: profile.enabledPresets,
      selectablePresets: selectable(profile.edition),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/settings/presets")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = patchSchema.parse(httpReq.body);
    const profile = await getFnbOrgProfile();
    const allowed = allowedFnbPresets(profile.edition);
    const outside = body.enabledPresets.filter((p) => !allowed.includes(p));
    if (outside.length > 0) {
      return sendJson(httpRes, { error: `FNB_PRESET_NOT_IN_EDITION: ${outside.join(", ")}` }, 403);
    }
    const shown = selectable(profile.edition);
    const kept = profile.enabledPresets.filter((p) => !shown.includes(p));
    const next = await setFnbEnabledPresets([...body.enabledPresets, ...kept]);
    return sendJson(httpRes, {
      edition: next.edition,
      enabledPresets: next.enabledPresets,
      selectablePresets: selectable(next.edition),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
