import { PatientMdmRequiredError } from "@/domain/patient/patient.service";
import { patientHasMdmIdentifier } from "@era/clinic-domain";

jest.mock("@era/satellite-kit", () => ({
  listPersonIdentifiers: jest.fn().mockResolvedValue({ identifiers: [] }),
  linkPersonIdentity: jest.fn().mockResolvedValue({ globalPersonId: null }),
  satelliteOrganizationId: jest.fn().mockReturnValue("test-org"),
  resolveSatelliteTenantOrgId: jest.fn().mockReturnValue("test-org"),
  enterSatelliteTenant: jest.fn(),
}));

jest.mock("@/lib/prisma", () => {
  const patientRef = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const tenant = {
    findFirst: jest.fn().mockResolvedValue({ id: "t1" }),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({
      nextPatientSeq: 2,
      organizationId: "test-org",
    }),
  };
  return {
    prisma: {
      patientRef,
      tenant,
      $transaction: jest.fn(async (fn: (tx: { tenant: typeof tenant; patientRef: typeof patientRef }) => unknown) =>
        fn({ tenant, patientRef }),
      ),
    },
  };
});

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
        givenName: "Test",
        surname: "Patient",
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
      fullName: "Test",
      phone: null,
      nationality: "AZ",
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
