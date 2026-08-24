import { qualifiesForNurseBonus } from "@/domain/procedure/nurse-bonus";
import { getImportAdapter } from "@/lib/import/adapters";

jest.mock("@era/satellite-kit", () => ({
  satelliteOrganizationId: () => "org-test",
}));

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
      fileRel: "dump/files/lab/57_QAN.docx",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      fileRel: "dump/files/lab/57_QAN.docx",
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

  it("quota upsert writes quotaTotal / quotaUsed", async () => {
    const adapter = getImportAdapter("quotas")!;
    const mapped = adapter.mapRow({
      patientRef: "wo:patient:1",
      procedureCode: "WO-TR-10",
      quotaTotal: 10,
      quotaUsed: 3,
      quotaLeft: 7,
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "bal1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue({ recordId: "pat1" }),
      },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ep1",
          programCode: "STD",
        }),
      },
      programInstance: { findUnique: jest.fn().mockResolvedValue({ id: "inst1" }) },
      programProcedureBalance: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quotaTotal: 10, quotaUsed: 3 }),
      }),
    );
  });

  it("lab upsert writes testCode and resultJson", async () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:1",
      patientRef: "wo:patient:1",
      testCode: "WO-LAB-FILE",
      status: "COMPLETED",
      resultText: "note",
      takenAt: "2026-02-18",
      fileRel: "",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "lab1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue({ id: "svc1" }) },
      labOrder: { create, update: jest.fn() },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          testCode: "WO-LAB-FILE",
          resultJson: expect.stringContaining("note"),
        }),
      }),
    );
  });

  it("lab upsert keeps COMPLETED when the Word file is missing", async () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:missing",
      patientRef: "wo:patient:1",
      testCode: "WO-LAB-FILE",
      status: "COMPLETED",
      resultText: "QAN.docx",
      takenAt: "2026-02-18",
      fileRel: "dump/files/lab/999999_missing.docx",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "lab-missing" });
    const update = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue(null) },
      labOrder: { create, update },
    };
    await expect(adapter.upsert(tx as never, row, false)).resolves.toBe("created");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultJson: expect.stringContaining("fileMissing"),
        }),
      }),
    );
  });
});
