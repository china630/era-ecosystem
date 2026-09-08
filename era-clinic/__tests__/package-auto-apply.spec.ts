jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalEpisode: { findUnique: jest.fn() },
    episodeCareDoctor: { findFirst: jest.fn() },
    visitServiceLine: { findFirst: jest.fn(), create: jest.fn() },
    visit: { create: jest.fn() },
    labOrder: { findFirst: jest.fn() },
    programInstance: { update: jest.fn() },
  },
}));

jest.mock("@/domain/lab/lab-order-write.service", () => ({
  createLabOrderWithItems: jest.fn(),
}));

jest.mock("@/domain/sanatorium/entitlement-usage.service", () => ({
  syncEntitlementUsage: jest.fn().mockResolvedValue(0),
}));

import { prisma } from "@/lib/prisma";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import {
  applyPackageAutoBlocks,
  resolveAutoBlockServiceCode,
} from "@/domain/sanatorium/package-auto-apply.service";

const mocked = prisma as unknown as {
  clinicalEpisode: { findUnique: jest.Mock };
  episodeCareDoctor: { findFirst: jest.Mock };
  visitServiceLine: { findFirst: jest.Mock; create: jest.Mock };
  visit: { create: jest.Mock };
  labOrder: { findFirst: jest.Mock };
  programInstance: { update: jest.Mock };
};

describe("resolveAutoBlockServiceCode", () => {
  it("resolves GYN-OR-URO by sex", () => {
    expect(resolveAutoBlockServiceCode("GYN-OR-URO", "FEMALE")).toBe("GYN-VISIT");
    expect(resolveAutoBlockServiceCode("GYN-OR-URO", "MALE")).toBe("URO-VISIT");
    expect(resolveAutoBlockServiceCode("GYN-OR-URO", "UNKNOWN")).toBeNull();
  });
});

describe("applyPackageAutoBlocks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.programInstance.update.mockResolvedValue({});
    mocked.visitServiceLine.findFirst.mockResolvedValue(null);
    mocked.labOrder.findFirst.mockResolvedValue(null);
    mocked.visit.create.mockResolvedValue({ id: "v1" });
    mocked.visitServiceLine.create.mockResolvedValue({ id: "vsl1" });
    (createLabOrderWithItems as jest.Mock).mockResolvedValue({ id: "lo1" });
  });

  it("returns NO_PROGRAM when instance missing", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep1",
      patientRefId: "p1",
      patientRef: { sex: "FEMALE" },
      programInstance: null,
    });
    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    expect(r).toEqual({ skipped: "NO_PROGRAM" });
  });

  it("AUTO_ON_OPEN creates lab order", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep1",
      organizationId: "org1",
      patientRefId: "p1",
      patientOrigin: "IN_HOUSE",
      reservationId: null,
      roomNumber: "101",
      patientRef: { sex: "FEMALE" },
      programInstance: {
        id: "pi1",
        templateId: "t1",
        programCode: "PKG-STANDART",
        autoApplyState: "PENDING",
        entitlementSnapshot: {
          version: 1,
          templateId: "t1",
          code: "PKG-STANDART",
          procedures: [
            {
              procedureCode: "ECG-12",
              procedureName: "ECG",
              quotaTotal: 1,
              kind: "LAB",
              sortOrder: 0,
              assignMode: "AUTO_ON_OPEN",
              fulfillment: "LAB_ORDER",
              quotaBasis: "PER_STAY",
              requiresDoctor: false,
            },
          ],
          knots: [],
          members: [],
        },
        procedureLines: [{ procedureCode: "ECG-12", quotaTotal: 1, quotaUsed: 0 }],
        template: { version: 1, procedures: [] },
      },
    });
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    expect("skipped" in r).toBe(false);
    if ("skipped" in r) return;
    expect(createLabOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicalEpisodeId: "ep1",
        codes: ["ECG-12"],
      }),
    );
    expect(r.createdLabCodes).toEqual(["ECG-12"]);
    expect(r.autoApplyState).toBe("APPLIED");
  });

  it("is idempotent when lab already exists", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep1",
      organizationId: "org1",
      patientRefId: "p1",
      patientOrigin: "IN_HOUSE",
      reservationId: null,
      roomNumber: null,
      patientRef: { sex: "MALE" },
      programInstance: {
        id: "pi1",
        templateId: "t1",
        programCode: "PKG-STANDART",
        autoApplyState: "PENDING",
        entitlementSnapshot: {
          version: 1,
          templateId: "t1",
          code: "PKG-STANDART",
          procedures: [
            {
              procedureCode: "ECG-12",
              procedureName: "ECG",
              quotaTotal: 1,
              kind: "LAB",
              sortOrder: 0,
              assignMode: "AUTO_ON_OPEN",
              fulfillment: "LAB_ORDER",
              quotaBasis: "PER_STAY",
              requiresDoctor: false,
            },
          ],
          knots: [],
          members: [],
        },
        procedureLines: [],
        template: { version: 1, procedures: [] },
      },
    });
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);
    mocked.labOrder.findFirst.mockResolvedValue({ id: "existing" });

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    expect(createLabOrderWithItems).not.toHaveBeenCalled();
    if ("skipped" in r) return;
    expect(r.skippedLabCodes).toContain("ECG-12");
    expect(r.autoApplyState).toBe("APPLIED");
  });

  it("PENDING_DOCTOR when requiresDoctor and no care team", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep1",
      organizationId: "org1",
      patientRefId: "p1",
      patientOrigin: "IN_HOUSE",
      reservationId: null,
      roomNumber: null,
      patientRef: { sex: "FEMALE" },
      programInstance: {
        id: "pi1",
        templateId: "t1",
        programCode: "PKG-STANDART",
        autoApplyState: "PENDING",
        entitlementSnapshot: {
          version: 1,
          templateId: "t1",
          code: "PKG-STANDART",
          procedures: [
            {
              procedureCode: "SANATORIUM-INTAKE",
              procedureName: "Intake",
              quotaTotal: 1,
              kind: "EXAM",
              sortOrder: 0,
              assignMode: "AUTO_ON_OPEN",
              fulfillment: "VISIT",
              quotaBasis: "PER_STAY",
              requiresDoctor: true,
            },
          ],
          knots: [],
          members: [],
        },
        procedureLines: [],
        template: { version: 1, procedures: [] },
      },
    });
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    if ("skipped" in r) return;
    expect(r.pendingDoctor).toBe(true);
    expect(r.autoApplyState).toBe("PENDING_DOCTOR");
    expect(mocked.visit.create).not.toHaveBeenCalled();
  });

  it("VISIT block without a doctor is PENDING_DOCTOR even when requiresDoctor is false", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "SANATORIUM-INTAKE",
        procedureName: "Intake",
        kind: "EXAM",
        fulfillment: "VISIT",
        requiresDoctor: false,
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    if ("skipped" in r) return;
    // Visit.practitionerId is non-null in schema, so the visit cannot be created.
    expect(r.pendingDoctor).toBe(true);
    expect(mocked.visit.create).not.toHaveBeenCalled();
  });

  it("re-creates a lab whose earlier order was cancelled", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "ECG-12",
        procedureName: "ECG",
        kind: "LAB",
        fulfillment: "LAB_ORDER",
        requiresDoctor: false,
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);
    mocked.labOrder.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "MANUAL_RETRY" });
    expect(mocked.labOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "CANCELLED" } }),
      }),
    );
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual(["ECG-12"]);
  });
});

function episodeWithBlock(block: {
  procedureCode: string;
  procedureName: string;
  kind: string;
  fulfillment: string;
  requiresDoctor: boolean;
}) {
  return {
    id: "ep1",
    organizationId: "org1",
    patientRefId: "p1",
    patientOrigin: "IN_HOUSE",
    reservationId: null,
    roomNumber: null,
    patientRef: { sex: "FEMALE" },
    programInstance: {
      id: "pi1",
      templateId: "t1",
      programCode: "PKG-STANDART",
      autoApplyState: "PENDING",
      entitlementSnapshot: {
        version: 1,
        templateId: "t1",
        code: "PKG-STANDART",
        procedures: [
          {
            quotaTotal: 1,
            sortOrder: 0,
            assignMode: "AUTO_ON_OPEN",
            quotaBasis: "PER_STAY",
            ...block,
          },
        ],
        knots: [],
        members: [],
      },
      procedureLines: [],
      template: { version: 1, procedures: [] },
    },
  };
}
