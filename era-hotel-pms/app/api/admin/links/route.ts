import { NextResponse } from "next/server";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fetchCpChannels, patchCpChannel } from "@/lib/cp-channels-client";
import { resolveOperatingMode } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.SCREEN_SETTINGS);
    const channels = await fetchCpChannels();
    const mode = await resolveOperatingMode(requestOrganizationId()).catch(() => null);
    return jsonOk({
      ...channels,
      operatingMode: mode,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.SCREEN_SETTINGS);
    const body = (await req.json()) as { channelId?: string; enabled?: boolean };
    if (!body.channelId || typeof body.enabled !== "boolean") {
      return jsonError("channelId and enabled required", 400);
    }
    const result = await patchCpChannel(body.channelId, body.enabled);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Channel update failed", status: result.status },
        { status: result.status >= 400 ? result.status : 502 },
      );
    }
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
