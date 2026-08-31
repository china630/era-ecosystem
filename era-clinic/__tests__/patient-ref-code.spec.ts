import {
  composeFullName,
  formatPatientRefCode,
  isClinicPatientRefCode,
  isLegacyExternalPatientRefCode,
  legacyRefCodeToExternalRef,
} from "../src/domain/patient/patient-ref-code";
import { formatNameAndCode } from "../src/lib/display-code";

describe("patient-ref-code", () => {
  it("formats P-###### sequences", () => {
    expect(formatPatientRefCode(1)).toBe("P-000001");
    expect(formatPatientRefCode(2162)).toBe("P-002162");
  });

  it("composes Ad Ata Soyad", () => {
    expect(composeFullName({ givenName: "Matluba", surname: "Umirzakova" })).toBe(
      "Matluba Umirzakova",
    );
    expect(
      composeFullName({
        givenName: "Əli",
        fatherName: "Vəli",
        surname: "Məmmədov",
      }),
    ).toBe("Əli Vəli Məmmədov");
  });

  it("detects clinic vs legacy codes", () => {
    expect(isClinicPatientRefCode("P-002162")).toBe(true);
    expect(isLegacyExternalPatientRefCode("wo-patient-2162")).toBe(true);
    expect(isLegacyExternalPatientRefCode("wo:patient:2162")).toBe(true);
    expect(isLegacyExternalPatientRefCode("WALKIN-ABC")).toBe(true);
    expect(isLegacyExternalPatientRefCode("P-000001")).toBe(false);
  });

  it("maps legacy display codes to cutover externalRef", () => {
    expect(legacyRefCodeToExternalRef("wo-patient-2162")).toBe("wo:patient:2162");
    expect(legacyRefCodeToExternalRef("wo:patient:99")).toBe("wo:patient:99");
    expect(legacyRefCodeToExternalRef("P-000001")).toBeNull();
  });
});

describe("formatNameAndCode", () => {
  it("renders Name (CODE)", () => {
    expect(formatNameAndCode("Sidik analizi", "LAB-URINE")).toBe(
      "Sidik analizi (LAB-URINE)",
    );
    expect(formatNameAndCode("", "LAB-CBC")).toBe("LAB-CBC");
    expect(formatNameAndCode("Only", "")).toBe("Only");
  });
});
