jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalEpisode: { findUnique: jest.fn() },
    episodeCareDoctor: { findFirst: jest.fn() },
    visitServiceLine: { findFirst: jest.fn() },
    visit: { findFirst: jest.fn(), create: jest.fn() },
    labOrder: { findFirst: jest.fn() },
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
  visitServiceLine: { findFirst: jest.Mock };
  visit: { findFirst: jest.Mock; create: jest.Mock };
  labOrder: { findFirst: jest.Mock };
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
    mockedPrisma.visit.findFirst.mockResolvedValue(null);
    mockedPrisma.labOrder.findFirst.mockResolvedValue(null);
    mockedPrisma.visit.create.mockResolvedValue({ id: "v1" });
    (createLabOrderWithItems as jest.Mock).mockResolvedValue({ id: "lo1" });
  });

  it("creates intake + GYN visit and ECG/USG orders when care team has a doctor", async () => {
    const r = await instantiateIntakePackage("ep1");
    expect(r.createdVisitCodes).toEqual(["SANATORIUM-INTAKE", "GYN-VISIT"]);
    expect(r.createdLabCodes).toEqual(["ECG-12", "USG-ABD"]);
    expect(mockedPrisma.visit.create).toHaveBeenCalledTimes(2);
    expect(createLabOrderWithItems).toHaveBeenCalledTimes(2);
  });

  it("skips intake visits when care team empty (labs still created)", async () => {
    mockedPrisma.episodeCareDoctor.findFirst.mockResolvedValue(null);
    const r = await instantiateIntakePackage("ep1");
    expect(r.createdVisitCodes).toEqual([]);
    expect(r.skippedVisitCodes).toEqual(["SANATORIUM-INTAKE", "GYN-VISIT"]);
    expect(r.createdLabCodes).toEqual(["ECG-12", "USG-ABD"]);
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
});
