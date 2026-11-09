jest.mock("@/lib/prisma", () => ({
  prisma: {
    patientRef: { findUnique: jest.fn() },
    clinicalEpisode: { findUnique: jest.fn() },
    programTemplate: { findFirst: jest.fn() },
    labOrder: { findFirst: jest.fn() },
    visit: { findFirst: jest.fn() },
    diagnosticService: { findMany: jest.fn().mockResolvedValue([]) },
    episodeBroughtInResult: { findMany: jest.fn().mockResolvedValue([]) },
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
      kind: "LAB",
      fulfillment: "LAB_ORDER",
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
  blockMembers: [
    { blockCode: "CARDIO-ECG", procedureCode: "CARDIO-ECG" },
    { blockCode: "LAB-CBC", procedureCode: "LAB-CBC" },
    { blockCode: "GYN", procedureCode: "VISIT-GYN" },
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

  it("puts the own-blank date on auto-paid infection biochemistry, not package blood biochem", async () => {
    const services = prisma as unknown as {
      diagnosticService: { findMany: jest.Mock };
    };
    services.diagnosticService.findMany.mockResolvedValue([
      {
        code: "LAB-BIOCHEM-STANDART",
        serviceCode: "LAB-BIOCHEM-STANDART",
        broughtInMaxDays: 30,
        autoPaidOnOpen: false,
        titleEn: "Blood biochemistry",
        titleRu: "Биохимия крови",
        titleAz: "Qanın biokimya analizi",
      },
      {
        code: "LAB-INFECT",
        serviceCode: "LAB-INFECT",
        broughtInMaxDays: 30,
        autoPaidOnOpen: false,
        titleEn: "Infections",
        titleRu: "Инфекции",
        titleAz: "İnfeksiya",
      },
      {
        code: "LAB-BIOCHEM-INFECT",
        serviceCode: "LAB-BIOCHEM-INFECT",
        broughtInMaxDays: 30,
        autoPaidOnOpen: true,
        titleEn: "Biochemistry (infections)",
        titleRu: "Биохимия (инфекции)",
        titleAz: "Biokimya (infeksiyalar)",
      },
    ]);
    mockedPrisma.programTemplate.findFirst.mockResolvedValue({
      ...template,
      procedures: [
        ...template.procedures,
        {
          procedureCode: "LAB-BIOCHEM-STANDART",
          procedureName: "Qanın biokimya analizi",
          assignMode: "AUTO_ON_OPEN",
          kind: "LAB",
          fulfillment: "LAB_ORDER",
          sortOrder: 5,
        },
        {
          procedureCode: "LAB-INFECT",
          procedureName: "İnfeksiya",
          assignMode: "AUTO_ON_OPEN",
          kind: "LAB",
          fulfillment: "LAB_ORDER",
          sortOrder: 6,
        },
      ],
      blockMembers: [
        ...template.blockMembers,
        { blockCode: "LAB-BIOCHEM-STANDART", procedureCode: "LAB-BIOCHEM-STANDART" },
        { blockCode: "LAB-INFECT", procedureCode: "LAB-INFECT" },
      ],
    });
    const checklist = await getIntakeChecklist("p1", { episodeId: "ep1" });
    expect(checklist.items.find((item) => item.resolvedCode === "LAB-BIOCHEM-STANDART")).toMatchObject({
      broughtInMaxDays: null,
      broughtInOn: null,
    });
    expect(checklist.items.find((item) => item.resolvedCode === "LAB-INFECT")).toMatchObject({
      broughtInMaxDays: 30,
    });
    expect(checklist.items.find((item) => item.slot === "LAB-BIOCHEM-INFECT")).toMatchObject({
      kind: "lab",
      broughtInMaxDays: 30,
      title: { ru: "Биохимия (инфекции)" },
    });
    services.diagnosticService.findMany.mockResolvedValue([]);
  });

  it("stays empty without an episode", async () => {
    const checklist = await getIntakeChecklist("p1");
    expect(checklist.items).toEqual([]);
    expect(mockedPrisma.clinicalEpisode.findUnique).not.toHaveBeenCalled();
  });
});
