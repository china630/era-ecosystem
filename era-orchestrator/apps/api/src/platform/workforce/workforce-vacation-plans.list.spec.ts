import { WorkforceVacationPlansService } from "./workforce-vacation-plans.service";

const ORG = "44444444-4444-4444-8444-444444444444";

describe("WorkforceVacationPlansService.list", () => {
  const prisma = {
    workforceVacationPlan: { findMany: jest.fn() },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const satelliteEvents = { enqueue: jest.fn() };
  const scopeService = { resolveScopeForCommercialOrg: jest.fn() };
  const employments = { resolvePersonProfiles: jest.fn() };

  const svc = new WorkforceVacationPlansService(
    prisma as never,
    entitlement as never,
    audit as never,
    satelliteEvents as never,
    scopeService as never,
    employments as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    scopeService.resolveScopeForCommercialOrg.mockResolvedValue({
      workforceScope: { id: "scope-1" },
    });
  });

  it("returns persons alongside items", async () => {
    prisma.workforceVacationPlan.findMany.mockResolvedValue([
      {
        id: "plan-1",
        year: 2026,
        lines: [{ employment: { globalPersonId: "person-1" } }],
      },
    ]);
    const persons = {
      "person-1": { displayName: "Ada Lovelace", accessDenied: false },
    };
    employments.resolvePersonProfiles.mockResolvedValue(persons);

    const out = await svc.list(ORG, {});

    expect(out.items).toHaveLength(1);
    expect(out.persons).toEqual(persons);
    expect(employments.resolvePersonProfiles).toHaveBeenCalledWith(ORG, [
      "person-1",
    ]);
  });
});
