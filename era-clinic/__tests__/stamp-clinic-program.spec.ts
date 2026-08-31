const {
  shouldStampProgram,
  overlayPatientProgramCodes,
  normalizePkg,
  ymd,
} = require("../scripts/nafta-cutover/stamp-clinic-program.cjs");

describe("stamp clinic program from EW notes", () => {
  it("accepts agency prefix, Həmkarlar, phrases; rejects medical-default and mix", () => {
    expect(
      shouldStampProgram({
        migrationSku: "PKG-PREMIUM",
        migrationSource: "agency-prefix",
        migrationConf: "high",
      }),
    ).toBe(true);
    expect(
      shouldStampProgram({
        migrationSku: "PKG-STANDART",
        migrationSource: "agency-prefix",
        stayKind: "medical",
      }),
    ).toBe(true);
    expect(
      shouldStampProgram({
        migrationSku: "PKG-DERMO",
        migrationSource: "phrase",
      }),
    ).toBe(true);
    expect(
      shouldStampProgram({
        migrationSku: "STANDART",
        migrationSource: "ERA-PKG",
      }),
    ).toBe(true);
    expect(
      shouldStampProgram({
        migrationSku: "PKG-STANDART",
        migrationSource: "price-note",
        migrationConf: "high",
      }),
    ).toBe(true);
    expect(
      shouldStampProgram({
        migrationSku: "PKG-STANDART",
        migrationSource: "agency-medical-default",
        migrationConf: "low",
        stayKind: "medical",
      }),
    ).toBe(true);
    expect(
      shouldStampProgram(
        {
          migrationSku: "PKG-STANDART",
          migrationSource: "agency-medical-default",
          migrationConf: "low",
        },
        { cutover: false },
      ),
    ).toBe(false);
    expect(
      shouldStampProgram({
        migrationSku: "PKG-STANDART",
        migrationSource: "price-note",
        mixHint: "compose-total 276",
      }),
    ).toBe(false);
    expect(
      shouldStampProgram({
        migrationSku: "PKG-STANDART",
        stayKind: "leisure",
        migrationSource: "phrase",
      }),
    ).toBe(false);
  });

  it("matches patient by name+arrival and room+date fallback", () => {
    const stamps = [
      {
        guests: "Afət Həsənov",
        arrival: "8/27/26",
        room: "306",
        migrationSku: "PKG-PREMIUM",
        migrationSource: "agency-prefix",
        migrationConf: "high",
        stayKind: "medical",
      },
      {
        guests: "Someone Else",
        arrival: "8/24/26",
        room: "402",
        migrationSku: "PKG-DERMO",
        migrationSource: "phrase",
        stayKind: "medical",
      },
    ];
    const rows = [
      {
        fullName: "Afət Həsənov",
        givenName: "Afət",
        surname: "Həsənov",
        checkIn: "2026-08-27T14:24:00+04:00",
        roomNumber: "306",
        programCode: "",
      },
      {
        fullName: "Unmatched Guest",
        checkIn: "2026-08-27T10:00:00+04:00",
        roomNumber: "999",
        programCode: "",
      },
      {
        fullName: "Room Only",
        checkIn: "2026-08-24T09:00:00+04:00",
        roomNumber: "402",
        programCode: "",
      },
    ];
    const stats = overlayPatientProgramCodes(rows, stamps);
    expect(rows[0].programCode).toBe("PKG-PREMIUM");
    expect(rows[1].programCode).toBe("");
    expect(rows[2].programCode).toBe("PKG-DERMO");
    expect(stats.stamped).toBe(2);
    expect(normalizePkg("PREMIUM")).toBe("PKG-PREMIUM");
    expect(ymd("8/27/26")).toBe("2026-08-27");
  });

  it("cutover stamps Walkin medical default and last-name unique join", () => {
    const stamps = [
      {
        guests: "Afət Həsənov",
        arrival: "8/27/26",
        room: "306",
        migrationSku: "PKG-STANDART",
        migrationSource: "agency-medical-default",
        stayKind: "medical",
      },
    ];
    const rows = [
      {
        fullName: "Həsənov Afət",
        checkIn: "2026-08-27T14:24:00+04:00",
        roomNumber: "306",
        programCode: "",
      },
    ];
    overlayPatientProgramCodes(rows, stamps);
    expect(rows[0].programCode).toBe("PKG-STANDART");
  });

  it("overwrites a previous SKU when Operator/phrase stamp differs", () => {
    const stamps = [
      {
        guests: "Test Guest",
        arrival: "9/15/26",
        room: "501",
        migrationSku: "PKG-PREMIUM",
        migrationSource: "phrase",
        stayKind: "medical",
      },
    ];
    const rows = [
      {
        fullName: "Test Guest",
        checkIn: "2026-09-15T14:00:00+04:00",
        roomNumber: "501",
        programCode: "PKG-STANDART",
      },
    ];
    const stats = overlayPatientProgramCodes(rows, stamps);
    expect(rows[0].programCode).toBe("PKG-PREMIUM");
    expect(stats.overwritten).toBe(1);
  });
});
