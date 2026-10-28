import { BillingSatelliteNotifyService } from "./billing-satellite-notify.service";

describe("BillingSatelliteNotifyService", () => {
  it("returns true when syncForOrg succeeds", async () => {
    const bindSync = { syncForOrg: jest.fn().mockResolvedValue({ results: [] }) };
    const svc = new BillingSatelliteNotifyService(bindSync as never);
    await expect(svc.afterModuleChange("org-1")).resolves.toBe(true);
    expect(bindSync.syncForOrg).toHaveBeenCalledWith("org-1");
  });

  it("returns false when syncForOrg throws (does not rethrow)", async () => {
    const bindSync = {
      syncForOrg: jest.fn().mockRejectedValue(new Error("pool down")),
    };
    const svc = new BillingSatelliteNotifyService(bindSync as never);
    await expect(svc.afterModuleChange("org-1")).resolves.toBe(false);
  });

  it("returns false for empty organizationId", async () => {
    const bindSync = { syncForOrg: jest.fn() };
    const svc = new BillingSatelliteNotifyService(bindSync as never);
    await expect(svc.afterModuleChange("  ")).resolves.toBe(false);
    expect(bindSync.syncForOrg).not.toHaveBeenCalled();
  });
});
