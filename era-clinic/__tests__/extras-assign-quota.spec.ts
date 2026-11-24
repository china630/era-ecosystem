import { remainingPackageQuotaCode, prescribeExtras } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";

jest.mock("@/domain/sanatorium/entitlement-charge.service", () => ({
  resolveEntitlementCharge: jest.fn().mockResolvedValue({ amountNet: 25 }),
  applyPriceMissingFallback: (_charge: { amountNet: number }) => ({ amountNet: 25 }),
  DEFAULT_OVER_QUOTA_AZN: 10,
}));

jest.mock("@/domain/sanatorium/package-assign.service", () => {
  const actual = jest.requireActual<typeof import("@/domain/sanatorium/package-assign.service")>(
    "@/domain/sanatorium/package-assign.service",
  );
  return {
    ...actual,
    resolveMasseurId: jest.fn().mockResolvedValue(null),
  };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    programInstance: { findFirst: jest.fn() },
    programTemplateBlockMember: { findMany: jest.fn() },
    procedureOrder: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    procedureOrderSite: { createMany: jest.fn() },
    clinicalEpisode: { findUnique: jest.fn() },
    practitioner: { findFirst: jest.fn() },
    episodeCareDoctor: { findMany: jest.fn() },
    procedureType: { findMany: jest.fn() },
    serviceCatalogCache: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));

jest.mock("@/domain/settings/settings.service", () => ({
  getClinicSettings: jest.fn().mockResolvedValue({ extraProcedureRoute: "HOLD_UNTIL_PAY" }),
}));

jest.mock("@/domain/sanatorium/lane-gates", () => ({
  procedureLaneDenial: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/domain/sanatorium/episode-care-team.service", () => ({
  countEpisodeCareDoctors: jest.fn().mockResolvedValue(1),
}));

jest.mock("@/domain/procedure/procedure-sex-gate", () => ({
  procedureFitsGuestSex: jest.fn().mockResolvedValue(true),
}));

import { prisma } from "@/lib/prisma";

const mocked = prisma as unknown as {
  programInstance: { findFirst: jest.Mock };
  programTemplateBlockMember: { findMany: jest.Mock };
  procedureOrder: { count: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  clinicalEpisode: { findUnique: jest.Mock };
  practitioner: { findFirst: jest.Mock };
  episodeCareDoctor: { findMany: jest.Mock };
  procedureType: { findMany: jest.Mock };
};

function stubEpisodeMocks() {
  mocked.clinicalEpisode.findUnique.mockResolvedValue({
    id: "ep-1",
    status: "OPEN",
    patientRefId: "pat-1",
    patientRef: { sex: "FEMALE" },
    patientOrigin: "IN_HOUSE",
    reservationId: "res-1",
    programInstance: null,
  });
  mocked.practitioner.findFirst.mockResolvedValue(null);
  mocked.episodeCareDoctor.findMany.mockResolvedValue([{ practitionerId: "doc-1" }]);
  mocked.procedureType.findMany.mockResolvedValue([
    { id: "pt-1", code: "SVC-MASSAGE", name: "Massage", durationMin: 30, openAttendance: false, bodyPart: null },
  ]);
}

describe("remainingPackageQuotaCode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.programTemplateBlockMember.findMany.mockResolvedValue([]);
  });

  it("returns code when quota remaining > 0", async () => {
    mocked.programInstance.findFirst.mockResolvedValue({
      templateId: "tpl-1",
      procedureLines: [{ procedureCode: "SVC-MASSAGE", quotaTotal: 5 }],
    });
    mocked.procedureOrder.count.mockResolvedValue(2);
    const code = await remainingPackageQuotaCode("ep-1", "SVC-MASSAGE");
    expect(code).toBe("SVC-MASSAGE");
  });

  it("returns null when quota is fully used (rem=0)", async () => {
    mocked.programInstance.findFirst.mockResolvedValue({
      templateId: "tpl-1",
      procedureLines: [{ procedureCode: "SVC-MASSAGE", quotaTotal: 5 }],
    });
    mocked.procedureOrder.count.mockResolvedValue(5);
    const code = await remainingPackageQuotaCode("ep-1", "SVC-MASSAGE");
    expect(code).toBeNull();
  });
});

describe("prescribeExtras package-first gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.programTemplateBlockMember.findMany.mockResolvedValue([]);
    stubEpisodeMocks();
  });

  it("throws QUOTA_REMAINING when package quota remains", async () => {
    mocked.programInstance.findFirst.mockResolvedValue({
      templateId: "tpl-1",
      procedureLines: [{ procedureCode: "SVC-MASSAGE", quotaTotal: 3 }],
    });
    mocked.procedureOrder.count.mockResolvedValue(1);
    await expect(
      prescribeExtras("ep-1", [{ procedureCode: "SVC-MASSAGE", qty: 1 }]),
    ).rejects.toMatchObject({
      code: "QUOTA_REMAINING",
      message: "Use package remaining before a paid extra",
    });
    expect(mocked.procedureOrder.create).not.toHaveBeenCalled();
  });

  it("does not throw QUOTA_REMAINING when rem=0", async () => {
    mocked.programInstance.findFirst.mockResolvedValue({
      templateId: "tpl-1",
      procedureLines: [{ procedureCode: "SVC-MASSAGE", quotaTotal: 2 }],
    });
    mocked.procedureOrder.count.mockResolvedValue(2);
    mocked.procedureOrder.create.mockResolvedValue({ id: "ord-new", schedulingMode: "FIXED" });
    mocked.procedureOrder.findMany.mockResolvedValue([]);
    await expect(
      prescribeExtras("ep-1", [{ procedureCode: "SVC-MASSAGE", qty: 1 }]),
    ).resolves.toBeDefined();
  });
});