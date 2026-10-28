const fetchSubscriptionSnapshot = jest.fn(async () => null as Record<string, unknown> | null);
const resolveEntitlementActiveModules = jest.fn(
  (snap: Record<string, unknown> | null) => {
    if (!snap) return null;
    const raw = snap.activeModules;
    return Array.isArray(raw)
      ? raw.filter((m): m is string => typeof m === "string")
      : [];
  },
);

jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {
    readonly status = 403;
    readonly moduleKey: string;
    constructor(moduleKey: string) {
      super(`Industry module not active: ${moduleKey}`);
      this.name = "IndustryModuleInactiveError";
      this.moduleKey = moduleKey;
    }
  }
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(async () => undefined),
    fetchSubscriptionSnapshot: (...args: unknown[]) =>
      fetchSubscriptionSnapshot(...(args as [string])),
    resolveEntitlementActiveModules: (...args: unknown[]) =>
      resolveEntitlementActiveModules(...(args as [Record<string, unknown> | null])),
  };
});

jest.mock("@/lib/fnb-org-profile", () => ({
  getFnbOrgProfile: jest.fn(),
  isHotelModeOff: jest.fn(async () => false),
}));

import { PERMISSIONS, kitchenPermissions } from "@/lib/auth/permissions";
import { routePermissions } from "@/lib/auth/page-route-permissions";
import {
  BUFFET_MEALS,
  BUFFET_STATUSES,
  effectiveBuffetPortions,
  planListAggregates,
} from "@/lib/buffet-planner-math";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { requireFnbSubmodule, FnbSubmoduleInactiveError } from "@/lib/fnb-module-gate";

describe("fnb buffet planner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps /admin/buffet to screen permission", () => {
    expect(routePermissions("/admin/buffet")).toEqual([PERMISSIONS.SCREEN_ADMIN_BUFFET]);
  });

  it("grants kitchen role buffet screen + API", () => {
    expect(kitchenPermissions()).toEqual(
      expect.arrayContaining([PERMISSIONS.SCREEN_ADMIN_BUFFET, PERMISSIONS.ADMIN_BUFFET]),
    );
  });

  it("exposes meal and status codes for CatalogField", () => {
    expect(BUFFET_MEALS).toEqual(["BREAKFAST", "LUNCH", "DINNER"]);
    expect(BUFFET_STATUSES).toEqual(["DRAFT", "LOCKED", "SERVED", "CLOSED"]);
  });

  it("ceilings portions after waste%", () => {
    expect(effectiveBuffetPortions(10, 0)).toBe(10);
    expect(effectiveBuffetPortions(10, 10)).toBe(11);
    expect(effectiveBuffetPortions(1, 50)).toBe(2);
  });

  it("aggregates list columns for plans table", () => {
    expect(
      planListAggregates([
        { plannedPortions: 10, station: "HOT", recipeSku: "R1", financeSku: null },
        { plannedPortions: 5, station: "HOT", recipeSku: null, financeSku: null },
        { plannedPortions: 2, station: "COLD", recipeSku: null, financeSku: "F1" },
      ]),
    ).toEqual({
      portionsSum: 17,
      stations: ["HOT", "COLD"],
      missingBomCount: 1,
    });
  });

  it("denies when modules are metered and fnb_buffet_planner is missing", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue(null);
    (getFnbOrgProfile as jest.Mock).mockResolvedValue({
      organizationId: "org-1",
      edition: "fnb",
      hotelMode: true,
      enabledPresets: ["restaurant"],
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos", "fnb_kitchen_kds"],
      businessDayStart: "05:00",
    });
    await expect(requireFnbSubmodule("fnb_buffet_planner", "org-1")).rejects.toBeInstanceOf(
      FnbSubmoduleInactiveError,
    );
  });

  it("allows when fnb_buffet_planner is in local activeModules (CP down)", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue(null);
    (getFnbOrgProfile as jest.Mock).mockResolvedValue({
      organizationId: "org-1",
      edition: "fnb",
      hotelMode: true,
      enabledPresets: ["restaurant"],
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos", "fnb_buffet_planner"],
      businessDayStart: "05:00",
    });
    await expect(requireFnbSubmodule("fnb_buffet_planner", "org-1")).resolves.toBeUndefined();
  });

  it("allows when CP snapshot has fnb_buffet_planner even if local profile lacks it", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue({
      activeModules: ["industry_fnb_pos", "fnb_buffet_planner"],
    });
    (getFnbOrgProfile as jest.Mock).mockResolvedValue({
      organizationId: "org-1",
      edition: "fnb",
      hotelMode: true,
      enabledPresets: ["restaurant"],
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos"],
      businessDayStart: "05:00",
    });
    await expect(requireFnbSubmodule("fnb_buffet_planner", "org-1")).resolves.toBeUndefined();
  });

  it("denies when CP snapshot is present without the submodule", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue({
      activeModules: ["industry_fnb_pos"],
    });
    (getFnbOrgProfile as jest.Mock).mockResolvedValue({
      organizationId: "org-1",
      edition: "fnb",
      hotelMode: true,
      enabledPresets: ["restaurant"],
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos", "fnb_buffet_planner"],
      businessDayStart: "05:00",
    });
    await expect(requireFnbSubmodule("fnb_buffet_planner", "org-1")).rejects.toBeInstanceOf(
      FnbSubmoduleInactiveError,
    );
  });

  it("falls back to local when CP snapshot omits activeModules", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue({ billingStatus: "ACTIVE" });
    (getFnbOrgProfile as jest.Mock).mockResolvedValue({
      organizationId: "org-1",
      edition: "fnb",
      hotelMode: true,
      enabledPresets: ["restaurant"],
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos", "fnb_buffet_planner"],
      businessDayStart: "05:00",
    });
    await expect(requireFnbSubmodule("fnb_buffet_planner", "org-1")).resolves.toBeUndefined();
  });
});
