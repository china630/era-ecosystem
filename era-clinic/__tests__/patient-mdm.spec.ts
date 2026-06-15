import { PatientMdmRequiredError } from "@/domain/patient/patient.service";
import { patientHasMdmIdentifier } from "@era/clinic-domain";

jest.mock("@/lib/patient-identity", () => ({
  linkPatientGlobalPerson: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    patientRef: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe("patient MDM enforcement", () => {
  it("requires identifier input", () => {
    expect(patientHasMdmIdentifier({})).toBe(false);
    expect(patientHasMdmIdentifier({ finCode: "ABC1234" })).toBe(true);
  });

  it("throws PatientMdmRequiredError when MDM unresolved", async () => {
    const { createPatient } = await import("@/domain/patient/patient.service");
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.create.mockResolvedValue({ id: "p1" });
    prisma.patientRef.findUniqueOrThrow.mockResolvedValue({ id: "p1", globalPersonId: null });

    await expect(
      createPatient({
        refCode: "P1",
        fullName: "Test",
        finCode: "ABC1234",
      }),
    ).rejects.toBeInstanceOf(PatientMdmRequiredError);
    expect(prisma.patientRef.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("throws PatientMdmRequiredError on PATCH when MDM unresolved", async () => {
    const { updatePatient } = await import("@/domain/patient/patient.service");
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.update.mockResolvedValue({
      id: "p2",
      finCode: "ABC1234",
      globalPersonId: null,
    });
    prisma.patientRef.findUniqueOrThrow.mockResolvedValue({
      id: "p2",
      globalPersonId: null,
    });

    await expect(updatePatient("p2", { finCode: "ABC1234" })).rejects.toBeInstanceOf(
      PatientMdmRequiredError,
    );
  });
});
