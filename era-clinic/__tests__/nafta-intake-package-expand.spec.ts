import { expandPackageCodes } from "@/domain/catalog/diagnostic-catalog-shared";
import type { DiagnosticCatalogItem } from "@/domain/catalog/diagnostic-catalog-shared";

describe("expandPackageCodes Nafta intake", () => {
  const items: DiagnosticCatalogItem[] = [
    {
      code: "PKG-NAFTA-INTAKE",
      kind: "package",
      modality: "PKG",
      category: "checkup",
      title: { en: "intake", ru: "intake", az: "intake" },
      serviceCode: "PKG-NAFTA-INTAKE",
      includes: ["VISIT-SANATORIUM-INTAKE", "GYN-OR-URO", "CARDIO-ECG", "USG-ABD"],
    },
    {
      code: "CARDIO-ECG",
      kind: "imaging",
      modality: "CARDIO",
      category: "ecg",
      title: { en: "ECG", ru: "ECG", az: "EKQ" },
      serviceCode: "CARDIO-ECG",
    },
    {
      code: "USG-ABD",
      kind: "imaging",
      modality: "USG",
      category: "abdomen",
      title: { en: "USG", ru: "USG", az: "USM" },
      serviceCode: "USG-ABD",
    },
    {
      code: "VISIT-SANATORIUM-INTAKE",
      kind: "visit",
      modality: "VISIT",
      category: "intake",
      title: { en: "intake", ru: "intake", az: "qebul" },
      serviceCode: "VISIT-SANATORIUM-INTAKE",
    },
  ];

  it("expands only orderable lab/imaging codes from PKG-NAFTA-INTAKE", () => {
    expect(expandPackageCodes(["PKG-NAFTA-INTAKE"], items)).toEqual(["CARDIO-ECG", "USG-ABD"]);
  });
});
