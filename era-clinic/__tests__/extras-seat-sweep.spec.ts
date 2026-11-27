/**
 * PLAN_BEFORE_PAY: unplaced FIXED extras must not linger as today's PENDING_PAY.
 */
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

const placeConfirmed = jest.fn();
jest.mock("@/lib/treatment-planner.service", () => ({
  placeConfirmedProcedures: (...args: unknown[]) => placeConfirmed(...args),
}));

jest.mock("@/domain/procedure/procedure-allocation.service", () => ({
  releaseProcedureOccupancy: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    programInstance: { findFirst: jest.fn() },
    programTemplateBlockMember: { findMany: jest.fn() },
    procedureOrder: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    procedureOrderSite: { createMany: jest.fn(), deleteMany: jest.fn() },
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
  getClinicSettings: jest.fn().mockResolvedValue({ extraProcedureRoute: "PLAN_BEFORE_PAY" }),
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

jest.mock("@/domain/sanatorium/stay-seat-cap", () => ({
  remainingUnifiedStayQty: jest.fn().mockResolvedValue(14),
}));

jest.mock("@/lib/satellite-audit", () => ({
  recordClinicAudit: jest.fn().mockResolvedValue(undefined),
}));

import {
  prescribeExtras,
  cancelUnpaidExtra,
  hardDeleteAbandonedExtraProposals,
} from "@/domain/sanatorium/extras-assign.service";
import { prisma } from "@/lib/prisma";

const mocked = prisma as unknown as {
  programInstance: { findFirst: jest.Mock };
  programTemplateBlockMember: { findMany: jest.Mock };
  procedureOrder: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  procedureOrderSite: { deleteMany: jest.Mock };
  clinicalEpisode: { findUnique: jest.Mock };
  practitioner: { findFirst: jest.Mock };
  episodeCareDoctor: { findMany: jest.Mock };
  procedureType: { findMany: jest.Mock };
};

describe("prescribeExtras PLAN_BEFORE_PAY seat sweep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.programTemplateBlockMember.findMany.mockResolvedValue([]);
    mocked.programInstance.findFirst.mockResolvedValue(null);
    mocked.clinicalEpisode.findUnique.mockResolvedValue({
      id: "ep-1",
      status: "OPEN",
      patientRefId: "pat-1",
      patientRef: { sex: "FEMALE" },
      patientOrigin: "IN_HOUSE",
      reservationId: "res-1",
      programInstance: { endsOn: new Date("2026-12-06T00:00:00Z") },
      plannedEndsOn: null,
    });
    mocked.practitioner.findFirst.mockResolvedValue(null);
    mocked.episodeCareDoctor.findMany.mockResolvedValue([{ practitionerId: "doc-1" }]);
    mocked.procedureType.findMany.mockResolvedValue([
      {
        id: "pt-1",
        code: "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
        name: "Super Inductive",
        durationMin: 30,
        openAttendance: false,
        bodyPart: null,
      },
    ]);
    mocked.procedureOrder.create.mockResolvedValue({
      id: "ord-1",
      schedulingMode: "FIXED",
    });
    mocked.procedureOrder.updateMany.mockResolvedValue({ count: 1 });
    mocked.procedureOrder.deleteMany.mockResolvedValue({ count: 1 });
    mocked.procedureOrderSite.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("creates PROPOSED then deletes leftovers when seating reports no placements", async () => {
    mocked.procedureOrder.findMany
      // purgeAbandonedExtraProposals (none)
      .mockResolvedValueOnce([])
      // created rows for FIXED vs OPEN split
      .mockResolvedValueOnce([{ id: "ord-1", schedulingMode: "FIXED" }])
      // stayEndForOrders
      .mockResolvedValueOnce([
        {
          clinicalEpisode: {
            plannedEndsOn: null,
            programInstance: { endsOn: new Date("2026-12-06T00:00:00Z") },
          },
        },
      ])
      // leftover sweep
      .mockResolvedValueOnce([
        {
          id: "ord-1",
          procedureCode: "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
          procedureName: "Super Inductive",
        },
      ]);
    placeConfirmed.mockResolvedValue({
      placed: 0,
      placedIds: [],
      missingCabinNames: [],
      failures: [],
    });

    const result = await prescribeExtras("ep-1", [
      { procedureCode: "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI", qty: 1 },
    ]);

    expect(mocked.procedureOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PROPOSED", inPackage: false }),
      }),
    );
    expect(mocked.procedureOrder.deleteMany).toHaveBeenCalled();
    expect(result.orderIds).toEqual([]);
    expect(result.misses.length).toBeGreaterThanOrEqual(1);
  });

  it("hard-deletes never-seated unpaid on reception cancel", async () => {
    mocked.procedureOrder.findUnique.mockResolvedValue({
      id: "ord-orphan",
      status: "PENDING_PAY",
      inPackage: false,
      resourceId: null,
      procedureCode: "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
    });
    mocked.procedureOrder.delete.mockResolvedValue({ id: "ord-orphan" });

    await cancelUnpaidExtra("ord-orphan", "user-1");

    expect(mocked.procedureOrder.delete).toHaveBeenCalledWith({ where: { id: "ord-orphan" } });
    expect(mocked.procedureOrder.update).not.toHaveBeenCalled();
  });

  it("soft-cancels seated unpaid on reception cancel", async () => {
    mocked.procedureOrder.findUnique.mockResolvedValue({
      id: "ord-seated",
      status: "PENDING_PAY",
      inPackage: false,
      resourceId: "cabin-1",
      procedureCode: "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
    });
    mocked.procedureOrder.update.mockResolvedValue({ id: "ord-seated" });

    await cancelUnpaidExtra("ord-seated", "user-1");

    expect(mocked.procedureOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelReason: "reception_unpaid_cancel",
        }),
      }),
    );
    expect(mocked.procedureOrder.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes abandoned mid-seat PROPOSED without cabin", async () => {
    mocked.procedureOrder.findMany.mockResolvedValueOnce([{ id: "ord-stuck" }]);
    mocked.procedureOrder.deleteMany.mockResolvedValueOnce({ count: 1 });
    mocked.procedureOrderSite.deleteMany.mockResolvedValueOnce({ count: 0 });

    const n = await hardDeleteAbandonedExtraProposals({
      episodeId: "ep-1",
      createdBefore: new Date("2026-11-27T12:00:00Z"),
    });

    expect(n).toBe(1);
    expect(mocked.procedureOrder.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["ord-stuck"] } },
    });
  });
});
