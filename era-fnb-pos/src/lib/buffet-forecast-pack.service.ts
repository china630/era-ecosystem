import { getBuffetCostSettings } from "@/lib/buffet-cost-settings.service";
import { buildForecastPack } from "@/lib/buffet-forecast-pack";
import { sumGuestNights } from "@/lib/buffet-guest-nights.service";
import { requestOrganizationId } from "@/lib/request-organization";

/**
 * Period forecast: guest-nights (stored or override) × key SKU norms → band + lines.
 */
export async function getBuffetForecastPackReport(args: {
  fromYmd: string;
  toYmd: string;
  /** Override total guest-nights (skips stored sum when set). */
  guestNightsOverride?: number;
  organizationId?: string;
}) {
  const organizationId = args.organizationId ?? requestOrganizationId();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(args.toYmd)) {
    throw Object.assign(new Error("from/to must be YYYY-MM-DD"), { code: "BAD_DATE" });
  }
  if (args.fromYmd > args.toYmd) {
    throw Object.assign(new Error("from must be on or before to"), { code: "DATE_ORDER" });
  }

  const settings = await getBuffetCostSettings(organizationId);
  const stored = await sumGuestNights({
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    organizationId,
  });

  const guestNights =
    args.guestNightsOverride != null && Number.isFinite(args.guestNightsOverride)
      ? Math.max(0, Math.floor(Number(args.guestNightsOverride)))
      : stored.total;

  const forecast = buildForecastPack({
    guestNights,
    pack: settings.forecastPack,
  });

  return {
    period: { from: args.fromYmd, to: args.toYmd },
    guestNightsSource:
      args.guestNightsOverride != null ? ("OVERRIDE" as const) : ("STORED" as const),
    guestNightsStored: stored.total,
    daysWithGuestNightData: stored.daysWithData,
    entries: stored.entries,
    forecastPack: settings.forecastPack,
    ...forecast,
  };
}
