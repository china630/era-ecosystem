import { z } from "zod";
import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { normalizeBusinessDayStart } from "@/lib/business-day";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const profile = await getFnbOrgProfile();
    return jsonOk({ businessDayStart: profile.businessDayStart });
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchSchema = z.object({
  businessDayStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export async function PATCH(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const body = patchSchema.parse(await request.json());
    const businessDayStart = normalizeBusinessDayStart(body.businessDayStart.slice(0, 5));
    const organizationId = requestOrganizationId();
    await prisma.fnbOrgProfile.upsert({
      where: { organizationId },
      create: { organizationId, businessDayStart },
      update: { businessDayStart },
    });
    return jsonOk({ businessDayStart });
  } catch (err) {
    return handleRouteError(err);
  }
}
