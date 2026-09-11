import { inferServiceCatalogKind } from "@/domain/catalog/service-catalog-kind";

describe("inferServiceCatalogKind", () => {
  const dept = "Laboratuar Müayinə";

  it("classifies by code prefix even when department is set", () => {
    expect(inferServiceCatalogKind("LAB-ALAT", dept)).toBe("LAB");
    expect(inferServiceCatalogKind("CARDIO-ECG", "Naftalan Müayinə Programı")).toBe(
      "DIAGNOSTIC",
    );
    expect(inferServiceCatalogKind("USG-ABD", dept)).toBe("DIAGNOSTIC");
    expect(inferServiceCatalogKind("VISIT-CHECKUP", "Poliklinika")).toBe("VISIT");
    expect(inferServiceCatalogKind("SVC-ELEKTROFOREZ", "Физиотерапия")).toBe(
      "PROCEDURE",
    );
  });

  it("uses department only for unknown commercial codes", () => {
    expect(inferServiceCatalogKind("NAFTA-BATH", "Naftalan vannası")).toBe("PROCEDURE");
    expect(inferServiceCatalogKind("MASSAGE")).toBe("OTHER");
  });
});
