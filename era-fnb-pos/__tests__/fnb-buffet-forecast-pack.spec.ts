import {
  buildForecastPack,
  defaultBuffetForecastPack,
  parseBuffetForecastPack,
  resolveForecastBand,
} from "@/lib/buffet-forecast-pack";
import { bandsOverlap, duplicateSkuCodes } from "@/lib/buffet-forecast-bands";

describe("buffet forecast pack (Wave 6)", () => {
  it("defaults include MEAT/OIL/FLOUR/PASTA and LOW/MID/HIGH bands", () => {
    const p = defaultBuffetForecastPack();
    expect(p.keySkuNorms.map((r) => r.sku)).toEqual(["MEAT", "OIL", "FLOUR", "PASTA"]);
    expect(p.bands.map((b) => b.code)).toEqual(["LOW", "MID", "HIGH"]);
  });

  it("resolves MID band for 200 guest-nights", () => {
    const band = resolveForecastBand(200, defaultBuffetForecastPack().bands);
    expect(band?.code).toBe("MID");
  });

  it("forecast qty = norm × guest nights", () => {
    const pack = parseBuffetForecastPack({
      keySkuNorms: [
        {
          sku: "MEAT",
          name: "Meat",
          unit: "kg",
          qtyPerGuestNight: 0.15,
          aznPerGuestNight: 2.5,
        },
      ],
      bands: defaultBuffetForecastPack().bands,
    });
    const r = buildForecastPack({ guestNights: 200, pack });
    expect(r.bandCode).toBe("MID");
    expect(r.lines[0]?.forecastQty).toBe(30);
    expect(r.lines[0]?.forecastAzn).toBe(500);
    expect(r.totalForecastAzn).toBe(500);
  });

  it("ignores empty sku rows", () => {
    const p = parseBuffetForecastPack({
      keySkuNorms: [{ sku: "", name: "x", unit: "kg", qtyPerGuestNight: 1 }],
    });
    expect(p.keySkuNorms[0]?.sku).toBe("MEAT");
  });
});

describe("buffet forecast band editor guards (Phase B)", () => {
  it("detects overlapping bands", () => {
    expect(
      bandsOverlap([
        { code: "LOW", minGuestNights: 0, maxGuestNights: 149 },
        { code: "MID", minGuestNights: 150, maxGuestNights: 249 },
      ]),
    ).toBe(false);
    expect(
      bandsOverlap([
        { code: "A", minGuestNights: 0, maxGuestNights: 100 },
        { code: "B", minGuestNights: 100, maxGuestNights: 200 },
      ]),
    ).toBe(true);
  });

  it("detects duplicate SKU codes", () => {
    expect(duplicateSkuCodes(["MEAT", "OIL"])).toBe(false);
    expect(duplicateSkuCodes(["MEAT", "meat"])).toBe(true);
  });
});
