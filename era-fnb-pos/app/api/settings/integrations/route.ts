import { NextResponse } from "next/server";
import { z } from "zod";
import { getSatelliteSession } from "@/lib/session";
import {
  denyUnlessAnyPermission,
  denyUnlessPermission,
} from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import {
  getFnbIntegrationSettings,
  upsertFnbIntegrationSettings,
} from "@/lib/fnb-integration-settings";

const patchSchema = z.object({
  financeWebUrl: z.string().max(500).optional(),
  hotelPmsUrl: z.string().max(500).optional(),
  orchestratorBaseUrl: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Read: Settings, Menu (recipes deep-link), or Buffet (Open Finance).
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_MENU,
      PERMISSIONS.SCREEN_ADMIN_BUFFET,
    ]);
    if (denied) return denied;
    const settings = await getFnbIntegrationSettings(session.organizationId);
    return jsonOk({ settings });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const body = patchSchema.parse(await request.json());
    const settings = await upsertFnbIntegrationSettings(body, session.organizationId);
    return jsonOk({ settings });
  } catch (err) {
    return handleRouteError(err);
  }
}
