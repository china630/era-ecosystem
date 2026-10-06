jest.mock("@/lib/prisma", () => ({
  prisma: {
    patientRef: { findUnique: jest.fn() },
    clinicalEpisode: { findUnique: jest.fn() },
    programTemplate: { findFirst: jest.fn() },
    labOrder: { findFirst: jest.fn() },
    visit: { findFirst: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getIntakeChecklist } from "@/domain/patient/intake-checklist.service";

const mockedPrisma = prisma as unknown as {
  patientRef: { findUnique: jest.Mock };
  clinicalEpisode: { findUnique: jest.Mock };
  programTemplate: { findFirst: jest.Mock };
  labOrder: { findFirst: jest.Mock };
  visit: { findFirst: jest.Mock };
};

const template = {
  name: "Standart",
  procedures: [
    {
      procedureCode: "CARDIO-ECG",
      procedureName: "EKQ",
      assignMode: "AUTO_ON_OPEN",
      kind: "CUSTOM",
      fulfillment: "PROCEDURE_ORDER",
      sortOrder: 1,
    },
    {
      procedureCode: "LAB-CBC",
      procedureName: "CBC",
      assignMode: "AUTO_DAY1",
      kind: "LAB",
      fulfillment: "LAB_ORDER",
      sortOrder: 2,
    },
    {
      procedureCode: "NAFTALAN_BATH",
      procedureName: "Bath",
      assignMode: "MANUAL",
      kind: "BATH",
      fulfillment: "PROCEDURE_ORDER",
      sortOrder: 3,
    },
    {
      procedureCode: "VISIT-SANATORIUM-INTAKE",
      procedureName: "Therapist",
      assignMode: "MANUAL",
      kind: "EXAM",
      fulfillment: "VISIT",
      sortOrder: 0,
    },
    {
      procedureCode: "GYN",
      procedureName: "Gynecologist",
      assignMode: "AUTO_ON_OPEN",
      kind: "EXAM",
      fulfillment: "VISIT",
      sortOrder: 4,
    },
  ],
};

describe("getIntakeChecklist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.patientRef.findUnique.mockResolvedValue({ sex: "FEMALE" });
    mockedPrisma.clinicalEpisode.findUnique.mockResolvedValue({
      programCode: "PKG-STANDART",
      organizationId: "org",
      _count: { careDoctors: 1 },
    });
    mockedPrisma.programTemplate.findFirst.mockResolvedValue(template);
    mockedPrisma.visit.findFirst.mockResolvedValue(null);
    mockedPrisma.labOrder.findFirst.mockImplementation(
      async (args: {
        where?: { items?: { some?: { serviceCode?: { in?: string[] } } } };
      }) => {
        const codes = args.where?.items?.some?.serviceCode?.in ?? [];
        if (codes.includes("CARDIO-ECG")) return { id: "lo-ecg", status: "ORDERED" };
        return null;
      },
    );
  });

  it("lists auto labs from the current template and skips manual rows", async () => {
    const checklist = await getIntakeChecklist("p1", { episodeId: "ep1" });
    expect(checklist.items.map((item) => item.slot)).toEqual([
      "CARDIO-ECG",
      "LAB-CBC",
      "GYN",
    ]);
    expect(checklist.items.find((item) => item.slot === "GYN")).toMatchObject({
      kind: "visit",
      status: "MISSING",
      scheduledAt: null,
    });
    expect(checklist.items.find((item) => item.slot === "CARDIO-ECG")?.status).toBe("ORDERED");
    expect(checklist.items.find((item) => item.slot === "LAB-CBC")?.status).toBe("MISSING");
    expect(checklist.items.find((item) => item.slot === "VISIT-SANATORIUM-INTAKE")).toBeUndefined();
  });

  it("stays empty until the first care-team doctor", async () => {
    mockedPrisma.clinicalEpisode.findUnique.mockResolvedValue({
      programCode: "PKG-STANDART",
      organizationId: "org",
      _count: { careDoctors: 0 },
    });
    const checklist = await getIntakeChecklist("p1", { episodeId: "ep1" });
    expect(checklist.items).toEqual([]);
    expect(mockedPrisma.programTemplate.findFirst).not.toHaveBeenCalled();
  });

  it("stays empty without an episode", async () => {
    const checklist = await getIntakeChecklist("p1");
    expect(checklist.items).toEqual([]);
    expect(mockedPrisma.clinicalEpisode.findUnique).not.toHaveBeenCalled();
  });
});
