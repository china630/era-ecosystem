jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalEpisode: { findUnique: jest.fn() },
    episodeCareDoctor: { findFirst: jest.fn() },
    visitServiceLine: { findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
    visit: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    labOrder: { findFirst: jest.fn() },
    programInstance: { findFirst: jest.fn() },
    programTemplateBlockMember: { findMany: jest.fn() },
    procedureOrder: { count: jest.fn() },
    labOrderItem: { count: jest.fn() },
    programProcedureBalance: { updateMany: jest.fn(), findUnique: jest.fn() },
    serviceCatalogCache: { findFirst: jest.fn() },
  },
}));

jest.mock("@/domain/lab/lab-order-write.service", () => ({
  createLabOrderWithItems: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import { instantiateIntakePackage } from "@/domain/patient/instantiate-intake.service";

const mockedPrisma = prisma as unknown as {
  clinicalEpisode: { findUnique: jest.Mock };
  episodeCareDoctor: { findFirst: jest.Mock };
  visitServiceLine: { findFirst: jest.Mock; create: jest.Mock; count: jest.Mock };
  visit: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  labOrder: { findFirst: jest.Mock };
  programInstance: { findFirst: jest.Mock };
  programTemplateBlockMember: { findMany: jest.Mock };
  procedureOrder: { count: jest.Mock };
  labOrderItem: { count: jest.Mock };
  programProcedureBalance: { updateMany: jest.Mock; findUnique: jest.Mock };
  serviceCatalogCache: { findFirst: jest.Mock };
};

describe("instantiateIntakePackage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep1",
      patientRefId: "p1",
      organizationId: "org1",
      patientOrigin: "IN_HOUSE",
      reservationId: null,
      roomNumber: "101",
      patientRef: { id: "p1", sex: "FEMALE" },
    });
    mockedPrisma.episodeCareDoctor.findFirst.mockResolvedValue({
      practitionerId: "doc1",
    });
    mockedPrisma.visitServiceLine.findFirst.mockResolvedValue(null);
    mockedPrisma.visitServiceLine.create.mockResolvedValue({ id: "line1" });
    mockedPrisma.visit.findFirst.mockResolvedValue(null);
    mockedPrisma.labOrder.findFirst.mockResolvedValue(null);
    mockedPrisma.visit.create.mockResolvedValue({ id: "v1" });
    mockedPrisma.visit.update.mockResolvedValue({ id: "v1" });
    mockedPrisma.serviceCatalogCache.findFirst.mockResolvedValue(null);
    mockedPrisma.programInstance.findFirst.mockResolvedValue(null);
    mockedPrisma.programTemplateBlockMember.findMany.mockResolvedValue([]);
    mockedPrisma.procedureOrder.count.mockResolvedValue(0);
    mockedPrisma.labOrderItem.count.mockResolvedValue(0);
    mockedPrisma.visitServiceLine.count.mockResolvedValue(0);
    mockedPrisma.programProcedureBalance.updateMany.mockResolvedValue({ count: 1 });
    (createLabOrderWithItems as jest.Mock).mockResolvedValue({ id: "lo1" });
  });

  it("creates intake + GYN visit and ECG/USG orders when care team has a doctor", async () => {
    const r = await instantiateIntakePackage("ep1");
    expect(r.createdVisitCodes).toEqual(["VISIT-SANATORIUM-INTAKE", "VISIT-GYN"]);
    expect(r.createdLabCodes).toEqual(["CARDIO-ECG", "USG-ABD"]);
    expect(mockedPrisma.visit.create).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.visitServiceLine.create).toHaveBeenCalledTimes(2);
    expect(createLabOrderWithItems).toHaveBeenCalledTimes(2);
  });

  it("skips intake visits when care team empty (labs still created)", async () => {
    mockedPrisma.episodeCareDoctor.findFirst.mockResolvedValue(null);
    const r = await instantiateIntakePackage("ep1");
    expect(r.createdVisitCodes).toEqual([]);
    expect(r.skippedVisitCodes).toEqual(["VISIT-SANATORIUM-INTAKE", "VISIT-GYN"]);
    expect(r.createdLabCodes).toEqual(["CARDIO-ECG", "USG-ABD"]);
    expect(mockedPrisma.visit.create).not.toHaveBeenCalled();
  });

  it("is idempotent when visits and labs already exist", async () => {
    mockedPrisma.visit.findFirst.mockResolvedValue({ id: "existing" });
    mockedPrisma.visitServiceLine.findFirst.mockResolvedValue({ id: "line" });
    mockedPrisma.labOrder.findFirst.mockResolvedValue({ id: "lab" });
    const r = await instantiateIntakePackage("ep1");
    expect(r.createdVisitCodes).toEqual([]);
    expect(r.createdLabCodes).toEqual([]);
    expect(mockedPrisma.visit.create).not.toHaveBeenCalled();
    expect(createLabOrderWithItems).not.toHaveBeenCalled();
  });

  it("stamps visit lines with packageQuotaCode when balance matches", async () => {
    mockedPrisma.programInstance.findFirst.mockResolvedValue({
      id: "inst1",
      entitlementSnapshot: null,
      procedureLines: [
        { procedureCode: "VISIT-SANATORIUM-INTAKE" },
        { procedureCode: "VISIT-GYN" },
      ],
    });
    await instantiateIntakePackage("ep1");
    expect(mockedPrisma.visitServiceLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceCode: "VISIT-SANATORIUM-INTAKE",
          inPackage: true,
          packageQuotaCode: "VISIT-SANATORIUM-INTAKE",
        }),
      }),
    );
  });
});
