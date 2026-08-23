import { qualifiesForNurseBonus } from "@/domain/procedure/nurse-bonus";
import { getImportAdapter } from "@/lib/import/adapters";

describe("nafta cutover import rules", () => {
  it("maps procedure rows from English headers", () => {
    const adapter = getImportAdapter("procedures")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:treatment:10",
      code: "WO-TR-10",
      nameAz: "Vanna",
      durationMin: "15",
      resourceGapMinutes: "5",
      patientRestMinutes: "10",
      price: "12.5",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      externalRef: "wo:treatment:10",
      code: "WO-TR-10",
      durationMin: 15,
    });
  });

  it("maps lab fileRel and keeps COMPLETED status", () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:57",
      patientRef: "wo:patient:451",
      testCode: "WO-LAB-FILE",
      status: "COMPLETED",
      resultText: "QAN.docx",
      takenAt: "2026-02-18",
      fileRel: "files/lab/57_QAN.docx",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      fileRel: "files/lab/57_QAN.docx",
      status: "COMPLETED",
    });
  });

  it("does not award nurse bonus on imported historical orders", () => {
    expect(
      qualifiesForNurseBonus({
        checkedInAt: new Date(),
        status: "COMPLETED",
        importedHistorical: true,
      }),
    ).toBe(false);
  });
});
