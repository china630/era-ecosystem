import { WorkforcePolicyService } from "./workforce-policy.service";

describe("WorkforcePolicyService", () => {
  it("returns cp_workforce when platform_workforce and satellite entitled", async () => {
    const subscriptionAccess = {
      hasModule: jest
        .fn()
        .mockImplementation((_org: string, key: string) =>
          Promise.resolve(key === "platform_workforce" || key === "industry_clinic"),
        ),
    };
    const service = new WorkforcePolicyService(subscriptionAccess as never);
    const result = await service.getPolicy("org-1", "industry_clinic");
    expect(result.hireMode).toBe("cp_workforce");
    expect(result.workforceModuleActive).toBe(true);
    expect(result.satelliteEntitled).toBe(true);
  });

  it("returns disabled when workforce module missing", async () => {
    const subscriptionAccess = {
      hasModule: jest
        .fn()
        .mockImplementation((_org: string, key: string) =>
          Promise.resolve(key === "industry_clinic"),
        ),
    };
    const service = new WorkforcePolicyService(subscriptionAccess as never);
    const result = await service.getPolicy("org-1", "industry_clinic");
    expect(result.hireMode).toBe("disabled");
  });
});
