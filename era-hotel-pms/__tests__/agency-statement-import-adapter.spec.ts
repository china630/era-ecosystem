import { mapHeaders } from "@/lib/import/helpers";
import { cellMoney } from "@/lib/import/helpers";
import { packageSellAdapter } from "@/lib/import/adapters/package-sell.adapter";
import { agencyStatementAdapter } from "@/lib/import/adapters/agency-statement.adapter";
import { IMPORT_PHASES } from "@/lib/import/phases";

describe("package-sell extra bed", () => {
  it("keeps extraBedAmount on desk rows", () => {
    const row = packageSellAdapter.mapRow(
      mapHeaders(
        {
          packageCode: "PKG-PREMIUM",
          packageName: "Nafta Premium",
          occupancy: 1,
          sellPrice: 193,
          desk: "Y",
          extraBedAmount: 48,
        },
        packageSellAdapter.headerAliases,
      ),
    );
    expect(row).toMatchObject({ extraBedAmount: 48, packageCode: "PKG-PREMIUM" });
  });
});

describe("agency-statement import adapter", () => {
  it("is last in the transactional phase", () => {
    expect(IMPORT_PHASES.find((p) => p.id === "transactional")?.entities).toContain(
      "agency-statement",
    );
  });

  it("parses EW remaining with thousands comma and skips zeros", () => {
    expect(cellMoney("20,311.60")).toBe(20311.6);
    expect(cellMoney("111.10")).toBe(111.1);
    const mapped = mapHeaders(
      {
        "Res Id": "60684342",
        "Agency Code": "London Travel leisure",
        Remaining: "111.10",
        "Guest Names": "Mircəlal Yaqubov",
        "Room No": "909",
        "T Date": "45499",
      },
      agencyStatementAdapter.headerAliases,
    );
    expect(agencyStatementAdapter.mapRow(mapped)).toMatchObject({
      reservationExternalRef: "60684342",
      remaining: 111.1,
      externalRef: "ew:agency-stmt:60684342",
    });
    expect(
      agencyStatementAdapter.mapRow(
        mapHeaders(
          { "Res Id": "1", "Agency Code": "X", Remaining: "0.00" },
          agencyStatementAdapter.headerAliases,
        ),
      ),
    ).toBeNull();
  });
});
