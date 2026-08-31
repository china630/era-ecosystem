jest.mock("@/lib/prisma", () => ({
  prisma: {
    patientRef: { findUnique: jest.fn() },
    labOrder: { findFirst: jest.fn() },
    labOrderItem: { findFirst: jest.fn() },
    visitServiceLine: { findFirst: jest.fn() },
    visit: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock("@/domain/catalog/diagnostic-catalog", () => ({
  getDiagnosticCatalog: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import { getIntakeChecklist } from "@/domain/patient/intake-checklist.service";

const mockedPrisma = prisma as unknown as {
  patientRef: { findUnique: jest.Mock };
  labOrder: { findFirst: jest.Mock };
  visitServiceLine: { findFirst: jest.Mock };
  visit: { findFirst: jest.Mock; findMany: jest.Mock };
};

describe("getIntakeChecklist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDiagnosticCatalog as jest.Mock).mockResolvedValue({
      items: [
        {
          code: "PKG-NAFTA-INTAKE",
          kind: "package",
          includes: ["SANATORIUM-INTAKE", "GYN-OR-URO", "ECG-12", "USG-ABD"],
          title: { en: "intake", ru: "intake", az: "ilkin" },
        },
      ],
    });
    mockedPrisma.patientRef.findUnique.mockResolvedValue({ id: "p1", sex: "FEMALE" });
    mockedPrisma.visitServiceLine.findFirst.mockResolvedValue(null);
    mockedPrisma.visit.findFirst.mockResolvedValue({ id: "v-att", status: "COMPLETED" });
    mockedPrisma.visit.findMany.mockResolvedValue([]);
    mockedPrisma.labOrder.findFirst.mockImplementation(
      async (args: {
        where?: {
          items?: { some?: { serviceCode?: string } };
          OR?: Array<{ testCode?: string | object }>;
          testCode?: string;
        };
      }) => {
        const w = args.where || {};
        const fromItem = w.items?.some?.serviceCode;
        const fromExact = typeof w.testCode === "string" ? w.testCode : undefined;
        const fromOr = (w.OR || [])
          .map((o) => (typeof o.testCode === "string" ? o.testCode : null))
          .find(Boolean);
        const code = fromItem || fromExact || fromOr;
        if (code === "USG-ABD") return { id: "lo-usg", status: "COMPLETED" };
        return null;
      },
    );
  });

  it("marks USG-ABD DONE when LabOrder exists with result", async () => {
    const checklist = await getIntakeChecklist("p1");
    const usg = checklist.items.find((i) => i.slot === "USG-ABD");
    const ecg = checklist.items.find((i) => i.slot === "ECG-12");
    const intake = checklist.items.find((i) => i.slot === "SANATORIUM-INTAKE");
    expect(usg?.status).toBe("DONE");
    expect(ecg?.status).toBe("MISSING");
    expect(intake?.status).toBe("DONE");
    expect(checklist.items).toHaveLength(4);
  });

  it("scopes LabOrder / Visit queries by clinicalEpisodeId when provided", async () => {
    await getIntakeChecklist("p1", { episodeId: "ep-this-year" });
    expect(mockedPrisma.labOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clinicalEpisodeId: "ep-this-year" }),
      }),
    );
    expect(mockedPrisma.visitServiceLine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visit: expect.objectContaining({ clinicalEpisodeId: "ep-this-year" }),
        }),
      }),
    );
  });
});