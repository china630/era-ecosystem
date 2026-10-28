import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { getBuffetForecastPackReport } from "@/lib/buffet-forecast-pack.service";
import { patchBuffetCostSettings } from "@/lib/buffet-cost-settings.service";
import { parseBuffetForecastPack } from "@/lib/buffet-forecast-pack";

const patchSchema = z
  .object({
    forecastPack: z
      .object({
        keySkuNorms: z
          .array(
            z.object({
              sku: z.string().min(1),
              name: z.string().min(1),
              unit: z.string().min(1),
              qtyPerGuestNight: z.number().min(0),
              aznPerGuestNight: z.number().min(0),
            }),
          )
          .min(1)
          .optional(),
        bands: z
          .array(
            z.object({
              code: z.string().min(1),
              minGuestNights: z.number().int().min(0),
              maxGuestNights: z.number().int().min(0).nullable(),
            }),
          )
          .min(1)
          .optional(),
      })
      .refine((v) => v.keySkuNorms != null || v.bands != null, {
        message: "forecastPack requires keySkuNorms and/or bands",
      }),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const overrideRaw = url.searchParams.get("guestNights");
    if (!from || !to) return jsonError("from and to are required", 400);
    let guestNightsOverride: number | undefined;
    if (overrideRaw != null && overrideRaw !== "") {
      const n = Number(overrideRaw);
      if (!Number.isFinite(n) || n < 0) {
        return jsonError("guestNights must be a non-negative number", 400);
      }
      guestNightsOverride = Math.floor(n);
    }
    const report = await getBuffetForecastPackReport({
      fromYmd: from,
      toYmd: to,
      guestNightsOverride,
    });
    return jsonOk(report);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      ((err as { code?: string }).code === "BAD_DATE" ||
        (err as { code?: string }).code === "DATE_ORDER")
    ) {
      return jsonError((err as Error).message, 400);
    }
    return handleRouteError(err);
  }
}

/** Save key-SKU norms / bands into org buffet cost settings. */
export async function PATCH(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) {
      const buffetDenied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
      if (buffetDenied) return buffetDenied;
    }
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = patchSchema.parse(await request.json());
    const forecastPack = parseBuffetForecastPack(body.forecastPack);
    const settings = await patchBuffetCostSettings({ forecastPack });
    return jsonOk({ forecastPack: settings.forecastPack });
  } catch (err) {
    return handleRouteError(err);
  }
}
