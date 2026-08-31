const {
  phraseSku,
  parseEraPkg,
  detectMix,
  enrichRow,
  joinLongNotes,
  appendMissingFoRows,
  agencySku,
} = require("../scripts/nafta-cutover/enrich-package-stamps.cjs");

describe("enrich package stamps for clinic #24", () => {
  it("reads ERA-PKG only from Extra Req, not Res Note", () => {
    expect(parseEraPkg("ERA-PKG PREMIUM")).toBe("PKG-PREMIUM");
    expect(parseEraPkg("")).toBeNull();
    const row = enrichRow({
      agency: "Walkin medical",
      EXTRA_REQ: "",
      RES_NOTE: "ERA-PKG PREMIUM",
      CIN_NOTE: "",
      OPERATOR_NOTE: "",
      PAYMENT_NOTE: "",
      stayKind: "unresolved",
    });
    expect(row.migrationSource).not.toBe("ERA-PKG");
    expect(row.migrationSku).toBe("PKG-STANDART");
    expect(row.migrationSource).toBe("agency-medical-default");
  });

  it("stamps Operator and Payment phrases as PREMIUM/DERMO", () => {
    const op = enrichRow({
      agency: "Həmkarlar İttifaqı  Konfederasiyası",
      EXTRA_REQ: "",
      RES_NOTE: "",
      CIN_NOTE: "",
      OPERATOR_NOTE: "Standart paketdən Premium paketə keçib",
      PAYMENT_NOTE: "",
      stayKind: "medical",
    });
    expect(op.migrationSku).toBe("PKG-PREMIUM");
    expect(op.migrationSource).toBe("phrase");

    const pay = enrichRow({
      agency: "Walkin medical",
      EXTRA_REQ: "",
      RES_NOTE: "",
      CIN_NOTE: "",
      OPERATOR_NOTE: "",
      PAYMENT_NOTE: "Premium paket. 3 nəfər premium paket bir otaqda. 349+174=523",
      stayKind: "unresolved",
    });
    expect(pay.migrationSku).toBe("PKG-PREMIUM");
    expect(pay.mixHint).toBeFalsy();
  });

  it("skips DERMO+STANDART mix; Həmkarlar without notes is STANDART", () => {
    const mix = enrichRow({
      agency: "Walkin medical",
      EXTRA_REQ: "",
      RES_NOTE: "",
      CIN_NOTE: "",
      OPERATOR_NOTE: "DERMO+STANDART",
      PAYMENT_NOTE: "",
      stayKind: "unresolved",
    });
    expect(mix.mixHint).toBeTruthy();
    expect(mix.migrationSku).toBeNull();

    expect(agencySku("Həmkarlar İttifaqı  Konfederasiyası")).toBe("PKG-STANDART");
    const hem = enrichRow({
      agency: "Həmkarlar İttifaqı  Konfederasiyası",
      EXTRA_REQ: "",
      RES_NOTE: "",
      CIN_NOTE: "",
      OPERATOR_NOTE: "",
      PAYMENT_NOTE: "",
      stayKind: "medical",
    });
    expect(hem.migrationSku).toBe("PKG-STANDART");
    expect(hem.migrationSource).toBe("agency-prefix");
  });

  it("joins Operator Note from #12 and appends missing FO Həmkarlar", () => {
    const joined = joinLongNotes(
      [{ externalRef: "92702072", EXTRA_REQ: "", RES_NOTE: "", PAYMENT_NOTE: "" }],
      [{ "Res Id": "92702072", "Note Type": "Operator Note", Notes: "Premium Paket. Tibbe melumat verilsin" }],
    );
    expect(joined[0].OPERATOR_NOTE).toMatch(/Premium Paket/);

    const rows = [{ externalRef: "1", agency: "X" }];
    const added = appendMissingFoRows(rows, [
      { "Res Id": "1", Agency: "Həmkarlar İttifaqı  Konfederasiyası" },
      {
        "Res Id": "96490724",
        Agency: "Həmkarlar İttifaqı  Konfederasiyası",
        "Guest Names": "ZAHİD HƏSƏNOV / NUVAR MƏMMƏDOVA",
        Arrival: "9/15/26",
        "Res State": "Reservation",
        "Price Note": "14*220 AZN",
      },
    ]);
    expect(added).toHaveLength(1);
    expect(added[0].externalRef).toBe("96490724");
    expect(rows).toHaveLength(2);
  });

  it("phraseSku maps dermo/premium paket lines", () => {
    expect(phraseSku("Dermo paket tibbə xəbər verilsin")).toBe("PKG-DERMO");
    expect(detectMix("Standart paketdən Premium paketə keçib", null)).toBeNull();
    expect(detectMix("DERMO+STANDART", null)).toBeTruthy();
  });
});
