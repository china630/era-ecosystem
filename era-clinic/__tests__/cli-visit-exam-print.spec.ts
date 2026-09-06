import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { sessionMayPrintVisitExam } from "@/lib/auth/visit-exam-print-access";
import {
  buildCpoePayloadSnapshot,
  resolvePrintedValue,
} from "@/domain/cpoe/cpoe-payload";
import type { DiagnosticCatalogItem } from "@/domain/catalog/diagnostic-catalog-shared";

describe("visit-exam print hardening", () => {
  it("sessionMayPrintVisitExam allows visits or patients API", () => {
    expect(
      sessionMayPrintVisitExam({
        role: "DOCTOR",
        login: "doc",
        permissions: [CLINIC_PERMISSION.API_VISITS],
      }),
    ).toBe(true);
    expect(
      sessionMayPrintVisitExam({
        role: "NURSE",
        login: "nurse",
        permissions: [CLINIC_PERMISSION.API_PATIENTS],
      }),
    ).toBe(true);
    expect(
      sessionMayPrintVisitExam({
        role: "FLOOR",
        login: "floor",
        permissions: [CLINIC_PERMISSION.API_CATALOG_READ],
      }),
    ).toBe(false);
  });

  it("buildCpoePayloadSnapshot stores field labels and qualitative options", () => {
    const item: DiagnosticCatalogItem = {
      code: "VISIT-T",
      kind: "visit",
      modality: "VISIT",
      category: "",
      title: { en: "Exam", ru: "Осмотр", az: "Baxış" },
      serviceCode: "VISIT-T",
      fields: [
        {
          key: "mood",
          type: "select",
          label: { en: "Mood", ru: "Настроение", az: "Əhval" },
          options: ["OK", "BAD"],
        },
      ],
      analytes: [
        {
          code: "GLU",
          label: { en: "Glucose", ru: "Глюкоза", az: "Qlükoza" },
          valueType: "QUALITATIVE",
          valueOptions: [
            { code: "POS", label: { en: "Positive", ru: "Полож.", az: "Müsbət" } },
          ],
        },
      ],
    };
    const snap = buildCpoePayloadSnapshot({
      item,
      fieldValues: { mood: "OK" },
      metaValues: {},
      lines: [{ code: "GLU", value: "POS" }],
    });
    expect(snap.v).toBe(1);
    expect(snap.fieldDefs[0]?.label.ru).toBe("Настроение");
    expect(snap.lines[0]?.valueOptions?.[0]?.code).toBe("POS");
    expect(resolvePrintedValue("POS", snap.lines[0]?.valueOptions, "ru")).toBe("Полож.");
    expect(resolvePrintedValue("OK", snap.fieldDefs[0]?.options, "en")).toBe("OK");
  });
});
