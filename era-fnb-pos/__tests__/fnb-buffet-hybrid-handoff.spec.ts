import {
  buildFinanceHandoffQuery,
  decodeTheoSku,
  encodeTheoSku,
} from "@/lib/buffet-handoff-query";

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-test",
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outlet: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/buffet-cost-run-export.service", () => ({
  exportBuffetCostRunSlice: jest.fn(),
  loadOutletPosLinesForCostRun: jest.fn().mockResolvedValue([
    {
      lineId: "l1",
      ticketId: "t1",
      qty: 2,
      unitPriceAzn: 0,
      kitchenStatus: "SERVED",
      paymentMethod: "COMP",
      description: "COMP",
      recipeSku: "MEAT",
      plu: "X",
    },
  ]),
}));

jest.mock("@/lib/buffet-finance-unit-cogs", () => ({
  resolveUnitCogsBySkuFromFinance: jest.fn().mockResolvedValue({
    unitCogsBySku: { MEAT: 18 },
    source: "finance",
    missingSkus: [],
  }),
}));

jest.mock("@/lib/buffet-forecast-pack.service", () => ({
  getBuffetForecastPackReport: jest.fn(),
}));

jest.mock("@/lib/buffet-cost-settings.service", () => ({
  getEffectiveBuffetCostForOutlet: jest.fn(),
  getBuffetCostSettings: jest.fn().mockResolvedValue({
    orgDefaults: { staffMealAznPerCover: 4 },
    outletOverrides: {},
    forecastPack: { keySkuNorms: [], bands: [] },
  }),
}));

jest.mock("@/lib/buffet-staff-meal.service", () => ({
  sumStaffCoversForPeriod: jest.fn().mockResolvedValue({
    planId: "sp1",
    coversStaffTotal: 25,
  }),
}));

import { prisma } from "@/lib/prisma";
import { exportBuffetCostRunSlice } from "@/lib/buffet-cost-run-export.service";
import { getBuffetForecastPackReport } from "@/lib/buffet-forecast-pack.service";
import { getEffectiveBuffetCostForOutlet } from "@/lib/buffet-cost-settings.service";
import { resolveUnitCogsBySkuFromFinance } from "@/lib/buffet-finance-unit-cogs";
import { buildHybridHandoffPack } from "@/lib/buffet-hybrid-handoff.service";

const exportMock = exportBuffetCostRunSlice as jest.MockedFunction<
  typeof exportBuffetCostRunSlice
>;
const cogsMock = resolveUnitCogsBySkuFromFinance as jest.MockedFunction<
  typeof resolveUnitCogsBySkuFromFinance
>;
const forecastMock = getBuffetForecastPackReport as jest.MockedFunction<
  typeof getBuffetForecastPackReport
>;
const effectiveMock = getEffectiveBuffetCostForOutlet as jest.MockedFunction<
  typeof getEffectiveBuffetCostForOutlet
>;
const outletFind = prisma.outlet.findFirst as jest.Mock;

describe("buffet handoff query (theoSku)", () => {
  it("round-trips theoSku encode/decode", () => {
    const encoded = encodeTheoSku({ MEAT: 500, OIL: 12.5, SKIP: -1 });
    expect(encoded).toBe("MEAT:500|OIL:12.5");
    expect(decodeTheoSku(encoded)).toEqual({ MEAT: 500, OIL: 12.5 });
  });

  it("buildFinanceHandoffQuery includes sale/comp/staff/theo", () => {
    const q = buildFinanceHandoffQuery({
      from: "2026-10-27",
      to: "2026-11-02",
      outletCode: "NAFTANI",
      posSaleAzn: 100,
      posCompAzn: 25.5,
      staffNetAzn: 40,
      theoreticalAzn: 512.5,
      theoreticalBySku: { MEAT: 500, OIL: 12.5 },
    });
    const params = new URLSearchParams(q);
    expect(params.get("outletCode")).toBe("NAFTANI");
    expect(params.get("posSaleAzn")).toBe("100");
    expect(params.get("posCompAzn")).toBe("25.5");
    expect(params.get("staffNetAzn")).toBe("40");
    expect(params.get("theoreticalAzn")).toBe("512.5");
    expect(params.get("theoSku")).toBe("MEAT:500|OIL:12.5");
  });
});

describe("buildHybridHandoffPack", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    outletFind.mockResolvedValue({
      id: "out-1",
      code: "NAFTANI",
      name: "Naftani",
    });
    exportMock.mockResolvedValue({
      outletId: "out-1",
      outletCode: "NAFTANI",
      outletName: "Naftani",
      period: { from: "2026-10-27", to: "2026-11-02" },
      buffetCostModel: "HYBRID",
      staffPlan: null,
      overlapSettings: { staffBuffetOverlap: "OVERLAP_PCT", overlapPct: 30 },
      pos: {
        saleAttributedAzn: 200,
        compAttributedAzn: 50,
        posAttributedAzn: 250,
        saleLineCount: 10,
        compLineCount: 2,
        saleQty: 10,
        compQty: 2,
        warnings: [],
        sampleLines: [],
      },
      foodUsage: 0,
      posAttributed: 250,
      staffGross: 100,
      staffNet: 70,
      buffetCoveredFromStaff: 30,
      attributed: 320,
      residualBuffet: 0,
      residualAfterOverlap: 0,
      overlap: { mode: "OVERLAP_PCT", overlapPct: 30 },
    } as Awaited<ReturnType<typeof exportBuffetCostRunSlice>>);
    forecastMock.mockResolvedValue({
      period: { from: "2026-10-27", to: "2026-11-02" },
      guestNightsSource: "STORED",
      guestNightsStored: 200,
      daysWithGuestNightData: 7,
      entries: [],
      forecastPack: {
        keySkuNorms: [
          {
            sku: "MEAT",
            name: "Meat",
            unit: "kg",
            qtyPerGuestNight: 0.15,
            aznPerGuestNight: 2.5,
          },
        ],
        bands: [],
      },
      guestNights: 200,
      band: null,
      bandCode: "MID",
      lines: [
        {
          sku: "MEAT",
          name: "Meat",
          unit: "kg",
          qtyPerGuestNight: 0.15,
          aznPerGuestNight: 2.5,
          forecastQty: 30,
          forecastAzn: 500,
        },
      ],
      totalForecastAzn: 500,
    } as Awaited<ReturnType<typeof getBuffetForecastPackReport>>);
    effectiveMock.mockResolvedValue({
      buffetCostModel: "HYBRID",
      staffBuffetOverlap: "OVERLAP_PCT",
      overlapPct: 30,
      cogsPostingMode: "DAY_DOCUMENT",
      inventoryGtThresholdAzn: 500,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      staffMealAznPerCover: 4,
      stocktakePolicy: {},
    } as Awaited<ReturnType<typeof getEffectiveBuffetCostForOutlet>>);
  });

  it("puts COMP + forecast norms into financeHandoffQuery", async () => {
    const pack = await buildHybridHandoffPack({
      outletId: "out-1",
      fromYmd: "2026-10-27",
      toYmd: "2026-11-02",
      staffGrossAzn: 100,
      staffGrossOverride: true,
      financeWebUrl: "http://localhost:3001",
    });
    const params = new URLSearchParams(pack.financeHandoffQuery);
    expect(params.get("posCompAzn")).toBe("50");
    expect(params.get("posSaleAzn")).toBe("200");
    expect(params.get("staffNetAzn")).toBe("70");
    expect(params.get("theoreticalAzn")).toBe("500");
    expect(params.get("theoSku")).toBe("MEAT:500");
    expect(pack.chefWarnings.some((w) => w.code === "FINANCE_URL_MISSING")).toBe(false);
    expect(exportMock).toHaveBeenCalledWith(
      expect.objectContaining({ unitCogsBySku: { MEAT: 18 } }),
    );
    expect(cogsMock).toHaveBeenCalled();
  });

  it("MODEL_OFF warning when outlet OFF", async () => {
    effectiveMock.mockResolvedValue({
      buffetCostModel: "OFF",
      staffBuffetOverlap: "OVERLAP_PCT",
      overlapPct: 30,
      cogsPostingMode: "DAY_DOCUMENT",
      inventoryGtThresholdAzn: 500,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      staffMealAznPerCover: 4,
      stocktakePolicy: {},
    } as Awaited<ReturnType<typeof getEffectiveBuffetCostForOutlet>>);
    const pack = await buildHybridHandoffPack({
      outletId: "out-1",
      fromYmd: "2026-10-27",
      toYmd: "2026-11-02",
      staffGrossAzn: 100,
      staffGrossOverride: true,
      financeWebUrl: "http://localhost:3001",
    });
    expect(pack.chefWarnings.some((w) => w.code === "MODEL_OFF")).toBe(true);
    expect(pack.buffetCostModel).toBe("OFF");
  });

  it("computes staffGross from covers × staffMealAznPerCover when no override", async () => {
    const pack = await buildHybridHandoffPack({
      outletId: "out-1",
      fromYmd: "2026-10-27",
      toYmd: "2026-11-02",
      financeWebUrl: "http://localhost:3001",
    });
    expect(pack.staff.staffGrossComputed).toBe(100);
    expect(pack.staff.staffGrossSource).toBe("COMPUTED");
    expect(exportMock).toHaveBeenCalledWith(
      expect.objectContaining({ staffGrossAzn: 100 }),
    );
  });
});
