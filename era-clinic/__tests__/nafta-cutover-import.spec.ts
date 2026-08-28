import { qualifiesForNurseBonus } from "@/domain/procedure/nurse-bonus";
import { getImportAdapter } from "@/lib/import/adapters";

jest.mock("@era/satellite-kit", () => ({
  satelliteOrganizationId: () => "org-test",
  resolveSatelliteTenantOrgId: () => "org-test",
  enterSatelliteTenant: () => undefined,
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

  it("maps lab order panel and COMPLETED status", () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:57",
      patientRef: "wo:patient:451",
      testCode: "LAB-CBC",
      status: "COMPLETED",
      panel: "QAN",
      takenAt: "2026-02-18",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      panel: "QAN",
      testCode: "LAB-CBC",
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

  it("diagnoses upsert uses CLOSED episode when no OPEN", async () => {
    const adapter = getImportAdapter("diagnoses")!;
    const mapped = adapter.mapRow({
      patientRef: "wo:patient:99",
      rawText: "Arxiv qeydi",
      icd10: "",
      recordedAt: "2024-01-15",
    });
    const row = adapter.rowSchema.parse(mapped);
    const createComplaint = jest.fn().mockResolvedValue({ id: "cmp1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({ id: "ep-closed", programCode: "CUTOVER-ARCHIVE" }),
        create: jest.fn(),
      },
      clinicalComplaint: { create: createComplaint },
      icdCode: { findFirst: jest.fn() },
      clinicalDiagnosis: { create: jest.fn() },
    };
    await adapter.upsert(tx as never, row, false);
    expect(createComplaint).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ episodeId: "ep-closed" }) }),
    );
  });

  it("procedure requirement upsert links procedure code to resource", async () => {
    const adapter = getImportAdapter("procedure-requirements")!;
    const mapped = adapter.mapRow({
      procedureCode: "WO-TR-47",
      resourceCode: "WO-ROOM-44",
      role: "LOCATION",
      quantity: "1",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "req1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      procedureType: {
        findFirst: jest.fn().mockResolvedValue({ id: "proc1" }),
      },
      resource: {
        findFirst: jest.fn().mockResolvedValue({ id: "res1" }),
      },
      procedureTypeRequirement: { create },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          procedureTypeId: "proc1",
          role: "LOCATION",
          resourceCode: "WO-ROOM-44",
          quantity: 1,
        }),
      }),
    );
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

  it("lab upsert writes testCode and empty resultJson array", async () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:1",
      patientRef: "wo:patient:1",
      testCode: "LAB-CBC",
      status: "COMPLETED",
      panel: "QAN",
      takenAt: "2026-02-18",
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
          testCode: "LAB-CBC",
          resultJson: "[]",
        }),
      }),
    );
  });

  it("lab result line upsert writes LabResult fields", async () => {
    const adapter = getImportAdapter("lab-results")!;
    const mapped = adapter.mapRow({
      orderRef: "wo:lab:1",
      code: "WBC",
      label: "WBC (Leykositlər)",
      value: "6.7",
      unit: "",
      refMin: "4.0",
      refMax: "10.0",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "r1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue({ recordId: "lab1" }),
      },
      labOrderItem: { findFirst: jest.fn().mockResolvedValue({ id: "item1" }) },
      labResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
      labOrder: {
        findUnique: jest.fn().mockResolvedValue({ resultJson: "[]" }),
        update: jest.fn(),
      },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "WBC", value: "6.7" }),
      }),
    );
  });
});
