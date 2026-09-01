import { SATELLITE_STAFF_PROVISIONED, WORKFORCE_EMPLOYMENT_HIRED } from "@era/contracts";
import { WorkforceProvisionService } from "./workforce-provision.service";

const PERSON = "11111111-1111-4111-8111-111111111111";
const UNIT = "22222222-2222-4222-8222-222222222222";
const POSITION = "33333333-3333-4333-8333-333333333333";
const ORG = "44444444-4444-4444-8444-444444444444";

describe("WorkforceProvisionService.hire seats", () => {
  const prisma = {
    orgUnit: { findFirst: jest.fn() },
    workforcePosition: { findUnique: jest.fn() },
    workforceSeatAllocation: { findFirst: jest.fn(), create: jest.fn() },
    workforceEmployment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workforceRoleBinding: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const mdm = {
    getPersonOpsProfile: jest.fn(),
    ensureWorkforceAccessGrant: jest.fn(),
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = { resolveScopeForCommercialOrg: jest.fn() };
  const positions = { assertSlotAvailable: jest.fn() };
  const templates = { resolveRole: jest.fn() };
  const seats = { assertSeatAvailable: jest.fn() };
  const audit = { log: jest.fn() };
  const satelliteEvents = { enqueue: jest.fn() };
  const subscriptionAccess = { hasModule: jest.fn() };

  const svc = new WorkforceProvisionService(
    prisma as never,
    mdm as never,
    entitlement as never,
    scope as never,
    positions as never,
    templates as never,
    seats as never,
    audit as never,
    satelliteEvents as never,
    subscriptionAccess as never,
  );

  const employmentRow = {
    id: "emp1",
    orgUnit: { name: "Housekeeping" },
    position: { name: "Cleaner" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    scope.resolveScopeForCommercialOrg.mockResolvedValue({
      workforceScopeId: "scope1",
      workforceScope: { id: "scope1", anchorOrganizationId: ORG },
    });
    mdm.getPersonOpsProfile.mockResolvedValue({ fullName: "Cleaner Person" });
    mdm.ensureWorkforceAccessGrant.mockResolvedValue(undefined);
    prisma.orgUnit.findFirst.mockResolvedValue({ id: UNIT, name: "Housekeeping" });
    positions.assertSlotAvailable.mockResolvedValue(undefined);
    prisma.workforcePosition.findUnique.mockResolvedValue({
      id: POSITION,
      name: "Cleaner",
      orgUnit: { name: "Housekeeping" },
    });
    subscriptionAccess.hasModule.mockResolvedValue(true);
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue(null);
    prisma.workforceEmployment.create.mockResolvedValue(employmentRow);
    prisma.workforceEmployment.findFirst.mockResolvedValue(null);
    prisma.workforceEmployment.update.mockResolvedValue(employmentRow);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    audit.log.mockResolvedValue(undefined);
    satelliteEvents.enqueue.mockResolvedValue({ jobId: "j1" });
  });

  it("empty satelliteKeys creates employment without a seat or STAFF_PROVISIONED", async () => {
    const result = await svc.hire(ORG, "actor1", {
      globalPersonId: PERSON,
      hireDate: "2026-08-01",
      orgUnitId: UNIT,
      positionId: POSITION,
      satelliteKeys: [],
    });

    expect(result.employment.id).toBe("emp1");
    expect(result.bindings).toEqual([]);
    expect(seats.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prisma.workforceSeatAllocation.create).not.toHaveBeenCalled();
    expect(prisma.workforceRoleBinding.create).not.toHaveBeenCalled();
    expect(satelliteEvents.enqueue).toHaveBeenCalledTimes(1);
    expect(satelliteEvents.enqueue.mock.calls[0][0].type).toBe(WORKFORCE_EMPLOYMENT_HIRED);
    expect(
      satelliteEvents.enqueue.mock.calls.some(
        (c: [{ type: string }]) => c[0].type === SATELLITE_STAFF_PROVISIONED,
      ),
    ).toBe(false);
  });

  it("second job with an existing seat does not allocate another seat", async () => {
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue({ id: "seat1" });
    templates.resolveRole.mockResolvedValue("RECEPTION");
    prisma.workforceRoleBinding.create.mockResolvedValue({
      id: "bind1",
      satelliteKey: "industry_hotel_pms",
    });

    await svc.hire(ORG, "actor1", {
      globalPersonId: PERSON,
      hireDate: "2026-08-01",
      orgUnitId: UNIT,
      positionId: POSITION,
      satelliteKeys: ["industry_hotel_pms"],
    });

    expect(seats.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prisma.workforceSeatAllocation.create).not.toHaveBeenCalled();
    expect(prisma.workforceEmployment.create).toHaveBeenCalled();
  });
});
