import {
  composeNaftaPackageNightlySell,
  composeNaftaPackageNightlySellBreakdown,
  paxCodesForCompose,
  type PackageSellCell,
} from "@/lib/services/nafta-package-compose.service";

/** Low-season singles sheet. Detoks Junior occupancy 3 (675) is not a cell. */
function lowSeasonCells(): PackageSellCell[] {
  const rows: Array<[string, string, number, number, number]> = [
    ["PKG-STANDART", "SDBL", 129, 219, 315],
    ["PKG-STANDART", "JSUIT", 139, 226, 322],
    ["PKG-STANDART", "DLX", 151, 249, 345],
    ["PKG-STANDART", "STRP", 129, 219, 285],
    ["PKG-PREMIUM", "JSUIT", 193, 349, 542],
    ["PKG-PREMIUM", "DLX", 193, 349, 542],
    ["PKG-DERMO", "SDBL", 180, 321, 501],
    ["PKG-DERMO", "JSUIT", 190, 328, 518],
    ["PKG-DERMO", "DLX", 202, 351, 531],
    ["PKG-DERMO", "STRP", 180, 321, 501],
    ["PKG-DETOKS", "SDBL", 178, 319, 497],
    ["PKG-DETOKS", "JSUIT", 188, 326, 0],
    ["PKG-DETOKS", "DLX", 200, 349, 549],
    ["PKG-DETOKS", "STRP", 178, 319, 497],
  ];
  const cells: PackageSellCell[] = [];
  for (const [code, roomCode, a, b, c] of rows) {
    cells.push({ code, roomCode, occupancy: 1, amount: a });
    cells.push({ code, roomCode, occupancy: 2, amount: b });
    if (c > 0) cells.push({ code, roomCode, occupancy: 3, amount: c });
  }
  return cells;
}

const cells = lowSeasonCells();

describe("package grid nightly sell", () => {
  it("same package uses the occupancy cell, not single plus companion", () => {
    expect(composeNaftaPackageNightlySell(["PKG-STANDART", "PKG-STANDART"], "SDBL", cells)).toBe(219);
    expect(
      composeNaftaPackageNightlySell(
        ["PKG-STANDART", "PKG-STANDART", "PKG-STANDART"],
        "STWN",
        cells,
      ),
    ).toBe(315);
  });

  it("two Standart plus Detoks in Junior low season is 404", () => {
    expect(
      composeNaftaPackageNightlySell(
        ["PKG-STANDART", "PKG-STANDART", "PKG-DETOKS"],
        "JSUIT",
        cells,
      ),
    ).toBe(404);
  });

  it("Premium plus Dermo is the flat pair 373", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-PREMIUM", "PKG-DERMO"], "DLX", cells),
    ).toBe(373);
  });

  it("Standart plus Premium in Junior low season is 332", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-STANDART", "PKG-PREMIUM"], "SUITE", cells),
    ).toBe(332);
  });

  it("Premium has no standard-room cell", () => {
    expect(composeNaftaPackageNightlySell(["PKG-PREMIUM"], "SDBL", cells)).toBeNull();
    expect(composeNaftaPackageNightlySell(["PKG-PREMIUM"], "JSUIT", cells)).toBe(193);
  });

  it("missing Detoks Junior occupancy 3 is not sold", () => {
    expect(
      composeNaftaPackageNightlySell(
        ["PKG-DETOKS", "PKG-DETOKS", "PKG-DETOKS"],
        "JSUIT",
        cells,
      ),
    ).toBeNull();
  });

  it("a missing required cell does not invent 96 or pricePerNight", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-STANDART", "PKG-PREMIUM"], "SDBL", []),
    ).toBeNull();
  });

  it("Dermo and Detoks one each puts the room delta on Dermo", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-DERMO", "PKG-DETOKS"], "DLX", cells),
    ).toBe(202 + 178);
  });

  it("unresolved codes are not a package night", () => {
    expect(composeNaftaPackageNightlySell([null, undefined], "SDBL", cells)).toBeNull();
    expect(composeNaftaPackageNightlySell(["BAR-FB", "RO"], "SDBL", cells)).toBeNull();
  });

  it("breakdown names the room block and the base block", () => {
    const b = composeNaftaPackageNightlySellBreakdown(
      ["PKG-STANDART", "PKG-PREMIUM"],
      "JSUIT",
      cells,
    );
    expect(b?.total).toBe(332);
    expect(b?.lines[0]).toMatchObject({ role: "main", code: "PKG-STANDART", amount: 139 });
    expect(b?.lines[1]).toMatchObject({ role: "companion", code: "PKG-PREMIUM", amount: 193 });
  });

  it("an empty guest package follows the stay SKU and an unnamed slot does not", () => {
    expect(
      paxCodesForCompose(
        [
          { firstName: "Kamal", lastName: "M", medicalPackageCode: "PKG-PREMIUM" },
          { firstName: "Aylin", lastName: "I", medicalPackageCode: "" },
          { medicalPackageCode: "" },
        ],
        "PKG-STANDART",
      ),
    ).toEqual(["PKG-PREMIUM", "PKG-STANDART"]);
  });

  it("two seasons may store the same amount as two cells", () => {
    const both: PackageSellCell[] = [
      ...cells,
      { code: "PKG-PREMIUM", roomCode: "JSUIT", occupancy: 1, amount: 193 },
    ];
    expect(composeNaftaPackageNightlySell(["PKG-PREMIUM"], "DLX", both)).toBe(193);
  });
});
