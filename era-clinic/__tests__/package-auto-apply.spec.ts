jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalEpisode: { findUnique: jest.fn() },
    episodeCareDoctor: { findFirst: jest.fn() },
    visitServiceLine: { findFirst: jest.fn(), create: jest.fn() },
    visit: { create: jest.fn() },
    labOrder: { findFirst: jest.fn() },
    programInstance: { update: jest.fn() },
    programTemplate: { findFirst: jest.fn() },
  },
}));

jest.mock("@/domain/lab/lab-order-write.service", () => ({
  createLabOrderWithItems: jest.fn(),
}));

jest.mock("@/domain/sanatorium/entitlement-usage.service", () => ({
  syncEntitlementUsage: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/domain/sanatorium/entitlement-charge.service", () => ({
  resolveEntitlementCharge: jest.fn().mockResolvedValue({
    amountNet: 0,
    overQuota: false,
    priceMissing: false,
    reason: "in_quota",
  }),
  applyPriceMissingFallback: (charge: {
    amountNet: number;
    overQuota: boolean;
    priceMissing: boolean;
    reason: string;
  }) => charge,
}));

import { prisma } from "@/lib/prisma";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import {
  applyPackageAutoBlocks,
  effectiveAutoFulfillment,
  fulfillmentRespectingStudyKind,
  overlayTemplateAxes,
  resolveAutoBlockServiceCode,
} from "@/domain/sanatorium/package-auto-apply.service";

const mocked = prisma as unknown as {
  clinicalEpisode: { findUnique: jest.Mock };
  episodeCareDoctor: { findFirst: jest.Mock };
  visitServiceLine: { findFirst: jest.Mock; create: jest.Mock };
  visit: { create: jest.Mock };
  labOrder: { findFirst: jest.Mock };
  programInstance: { update: jest.Mock };
  programTemplate: { findFirst: jest.Mock };
};

describe("fulfillmentRespectingStudyKind", () => {
  it("reads LAB and EXAM when fulfillment is the procedure default", () => {
    expect(fulfillmentRespectingStudyKind("LAB", "PROCEDURE_ORDER")).toBe("LAB_ORDER");
    expect(fulfillmentRespectingStudyKind("EXAM", "PROCEDURE_ORDER")).toBe("VISIT");
    expect(fulfillmentRespectingStudyKind("LAB", null)).toBe("LAB_ORDER");
  });

  it("books ECG and USG aliases when the block is still a procedure", () => {
    expect(
      effectiveAutoFulfillment(
        { procedureCode: "ECG", kind: "CUSTOM", fulfillment: "PROCEDURE_ORDER" },
        "FEMALE",
      ),
    ).toBe("LAB_ORDER");
    expect(
      effectiveAutoFulfillment(
        { procedureCode: "USG", kind: "CUSTOM", fulfillment: "PROCEDURE_ORDER" },
        "FEMALE",
      ),
    ).toBe("LAB_ORDER");
    expect(
      effectiveAutoFulfillment(
        { procedureCode: "PHYSIO_POOL", kind: "PHYSIO", fulfillment: "PROCEDURE_ORDER" },
        "FEMALE",
      ),
    ).toBe("PROCEDURE_ORDER");
  });

  it("keeps an explicit study fulfillment and does not retarget treatment", () => {
    expect(fulfillmentRespectingStudyKind("LAB", "VISIT")).toBe("VISIT");
    expect(fulfillmentRespectingStudyKind("PHYSIO", "PROCEDURE_ORDER")).toBe("PROCEDURE_ORDER");
    expect(fulfillmentRespectingStudyKind("BATH", null)).toBe("PROCEDURE_ORDER");
  });
});

describe("resolveAutoBlockServiceCode", () => {
  it("resolves GYN-OR-URO by sex", () => {
    expect(resolveAutoBlockServiceCode("GYN-OR-URO", "FEMALE")).toBe("VISIT-GYN");
    expect(resolveAutoBlockServiceCode("GYN-OR-URO", "MALE")).toBe("VISIT-URO");
    expect(resolveAutoBlockServiceCode("GYN-OR-URO", "UNKNOWN")).toBeNull();
  });
});

describe("applyPackageAutoBlocks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.programInstance.update.mockResolvedValue({});
    mocked.programTemplate.findFirst.mockResolvedValue(null);
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
              procedureCode: "CARDIO-ECG",
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
        procedureLines: [{ procedureCode: "CARDIO-ECG", quotaTotal: 1, quotaUsed: 0 }],
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
        codes: ["CARDIO-ECG"],
      }),
    );
    expect(r.createdLabCodes).toEqual(["CARDIO-ECG"]);
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
              procedureCode: "CARDIO-ECG",
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
    expect(r.skippedLabCodes).toContain("CARDIO-ECG");
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
              procedureCode: "VISIT-SANATORIUM-INTAKE",
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
        procedureCode: "VISIT-SANATORIUM-INTAKE",
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
        procedureCode: "CARDIO-ECG",
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
    expect(r.createdLabCodes).toEqual(["CARDIO-ECG"]);
  });

  it("AUTO lab stored as PROCEDURE_ORDER still creates a lab order", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "LAB-CBC",
        procedureName: "CBC",
        kind: "LAB",
        fulfillment: "PROCEDURE_ORDER",
        requiresDoctor: false,
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual(["LAB-CBC"]);
    expect(createLabOrderWithItems).toHaveBeenCalled();
  });

  it("MANUAL lab is not created just because its kind is LAB", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "LAB-CBC",
        procedureName: "CBC",
        kind: "LAB",
        fulfillment: "PROCEDURE_ORDER",
        requiresDoctor: false,
        assignMode: "MANUAL",
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual([]);
    expect(createLabOrderWithItems).not.toHaveBeenCalled();
  });

  it("CARE_TEAM retries a day-1 exam that was waiting on a doctor", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "NEURO",
        procedureName: "Neurologist",
        kind: "EXAM",
        fulfillment: "PROCEDURE_ORDER",
        requiresDoctor: false,
        assignMode: "AUTO_DAY1",
        autoApplyState: "PENDING_DOCTOR",
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue({ practitionerId: "doc1" });

    const r = await applyPackageAutoBlocks("ep1", { trigger: "CARE_TEAM" });
    if ("skipped" in r) return;
    expect(r.createdVisitCodes).toEqual(["NEURO"]);
    expect(mocked.visit.create).toHaveBeenCalled();
  });

  it("creates an ECG lab from an auto procedure block", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "ECG",
        procedureName: "EKQ",
        kind: "CUSTOM",
        fulfillment: "PROCEDURE_ORDER",
        requiresDoctor: false,
        assignMode: "AUTO_ON_OPEN",
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);

    const r = await applyPackageAutoBlocks("ep1", { trigger: "OPEN" });
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual(["CARDIO-ECG"]);
  });

  it("MANUAL_RETRY reads current template axes and creates a day-1 lab", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "ALT",
        procedureName: "ALAT",
        kind: "LAB",
        fulfillment: "LAB_ORDER",
        requiresDoctor: false,
        assignMode: "MANUAL",
        autoApplyState: "APPLIED",
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue(null);
    mocked.programTemplate.findFirst.mockResolvedValue({
      procedures: [
        {
          procedureCode: "ALT",
          assignMode: "AUTO_DAY1",
          fulfillment: "LAB_ORDER",
          kind: "LAB",
          requiresDoctor: false,
        },
      ],
    });

    const r = await applyPackageAutoBlocks("ep1", { trigger: "MANUAL_RETRY" });
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual(["ALT"]);
    expect(mocked.programInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entitlementSnapshot: expect.objectContaining({
            procedures: [expect.objectContaining({ assignMode: "AUTO_DAY1", quotaTotal: 1 })],
          }),
        }),
      }),
    );
  });

  it("overlay keeps the course quota when the template axis changes", () => {
    const [row] = overlayTemplateAxes(
      [
        {
          procedureCode: "ALT",
          procedureName: "ALAT",
          quotaTotal: 7,
          quotaBasis: "PER_NIGHTS",
          assignMode: "MANUAL",
          fulfillment: "LAB_ORDER",
          requiresDoctor: false,
          kind: "LAB",
          sortOrder: 0,
        },
      ],
      [{ procedureCode: "ALT", assignMode: "AUTO_ON_OPEN", fulfillment: "LAB_ORDER", kind: "LAB" }],
    );
    expect(row?.quotaTotal).toBe(7);
    expect(row?.assignMode).toBe("AUTO_ON_OPEN");
  });

  it("CARE_TEAM creates a day-1 lab together with the other auto blocks", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue(
      episodeWithBlock({
        procedureCode: "LAB-CBC",
        procedureName: "CBC",
        kind: "LAB",
        fulfillment: "PROCEDURE_ORDER",
        requiresDoctor: false,
        assignMode: "AUTO_DAY1",
        autoApplyState: "PENDING_DOCTOR",
      }),
    );
    mocked.episodeCareDoctor.findFirst.mockResolvedValue({ practitionerId: "doc1" });

    const r = await applyPackageAutoBlocks("ep1", { trigger: "CARE_TEAM" });
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual(["LAB-CBC"]);
    expect(createLabOrderWithItems).toHaveBeenCalled();
  });

  it("first doctor creates auto orders before the package instance exists", async () => {
    mocked.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep1",
      organizationId: "org1",
      patientRefId: "p1",
      programCode: "PKG-STANDART",
      patientOrigin: "IN_HOUSE",
      reservationId: null,
      roomNumber: null,
      patientRef: { sex: "FEMALE" },
      programInstance: null,
    });
    mocked.episodeCareDoctor.findFirst.mockResolvedValue({ practitionerId: "doc1" });
    mocked.programTemplate.findFirst.mockResolvedValue({
      id: "t4",
      version: 4,
      code: "PKG-STANDART",
      procedures: [
        {
          procedureCode: "ALT",
          procedureName: "ALAT",
          quotaTotal: 1,
          kind: "LAB",
          sortOrder: 0,
          assignMode: "AUTO_ON_OPEN",
          fulfillment: "LAB_ORDER",
          quotaBasis: "PER_NIGHTS",
          requiresDoctor: false,
        },
        {
          procedureCode: "PHYSIO_POOL",
          procedureName: "Physio",
          quotaTotal: 10,
          kind: "PHYSIO",
          sortOrder: 1,
          assignMode: "MANUAL",
          fulfillment: "PROCEDURE_ORDER",
          quotaBasis: "PER_NIGHTS",
          requiresDoctor: false,
        },
      ],
    });

    const r = await applyPackageAutoBlocks("ep1", { trigger: "CARE_TEAM" });
    if ("skipped" in r) return;
    expect(r.createdLabCodes).toEqual(["ALT"]);
    expect(mocked.programInstance.update).not.toHaveBeenCalled();
  });
});

function episodeWithBlock(block: {
  procedureCode: string;
  procedureName: string;
  kind: string;
  fulfillment: string;
  requiresDoctor: boolean;
  assignMode?: string;
  autoApplyState?: string;
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
      autoApplyState: block.autoApplyState ?? "PENDING",
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
