import { WorkforceAbsenceSyncService } from "./workforce-absence-sync.service";

describe("WorkforceAbsenceSyncService", () => {
  it("skips approved event when org lacks hr_full", async () => {
    const subscriptionAccess = {
      hasModule: jest.fn().mockResolvedValue(false),
    };
    const svc = new WorkforceAbsenceSyncService(
      {} as never,
      {} as never,
      subscriptionAccess as never,
    );
    const result = await svc.handleApproved("660e8400-e29b-41d4-a716-446655440001", {
      type: "WORKFORCE_ABSENCE_APPROVED",
      organizationId: "660e8400-e29b-41d4-a716-446655440001",
      correlationId: "c1",
      occurredAt: "2026-06-01T00:00:00.000Z",
      globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
      payload: {
        cpAbsenceId: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "660e8400-e29b-41d4-a716-446655440001",
        employmentId: "770e8400-e29b-41d4-a716-446655440002",
        globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
        kind: "VACATION",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
      },
    });
    expect(result.meta).toEqual({ skipped: true, reason: "no_hr_full" });
  });
});
