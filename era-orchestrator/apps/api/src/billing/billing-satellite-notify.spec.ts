import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";
import { SatelliteChannelsService } from "../channels/satellite-channels.service";
import { BillingSatelliteNotifyService } from "./billing-satellite-notify.service";

describe("BillingSatelliteNotifyService", () => {
  function moduleRefWith(opts: {
    bindSync?: { syncForOrg: jest.Mock };
    channels?: { syncPlatformChannels: jest.Mock };
  }) {
    const bindSync =
      opts.bindSync ??
      ({ syncForOrg: jest.fn().mockResolvedValue({ results: [] }) } as {
        syncForOrg: jest.Mock;
      });
    const channels =
      opts.channels ??
      ({
        syncPlatformChannels: jest.fn().mockResolvedValue(undefined),
      } as { syncPlatformChannels: jest.Mock });
    return {
      bindSync,
      channels,
      moduleRef: {
        get: jest.fn().mockImplementation((token: unknown) => {
          if (token === SatelliteOrgBindSyncService) return bindSync;
          if (token === SatelliteChannelsService) return channels;
          return undefined;
        }),
      },
    };
  }

  it("returns true when syncForOrg succeeds and also syncs channels", async () => {
    const { bindSync, channels, moduleRef } = moduleRefWith({});
    const svc = new BillingSatelliteNotifyService(moduleRef as never);
    await expect(svc.afterModuleChange("org-1")).resolves.toBe(true);
    expect(bindSync.syncForOrg).toHaveBeenCalledWith("org-1");
    expect(channels.syncPlatformChannels).toHaveBeenCalledWith("org-1");
  });

  it("returns false when syncForOrg throws but still attempts channel sync", async () => {
    const bindSync = {
      syncForOrg: jest.fn().mockRejectedValue(new Error("pool down")),
    };
    const channels = {
      syncPlatformChannels: jest.fn().mockResolvedValue(undefined),
    };
    const { moduleRef } = moduleRefWith({ bindSync, channels });
    const svc = new BillingSatelliteNotifyService(moduleRef as never);
    await expect(svc.afterModuleChange("org-1")).resolves.toBe(false);
    expect(channels.syncPlatformChannels).toHaveBeenCalledWith("org-1");
  });

  it("returns true when bind ok even if channel sync throws", async () => {
    const channels = {
      syncPlatformChannels: jest.fn().mockRejectedValue(new Error("ch down")),
    };
    const { bindSync, moduleRef } = moduleRefWith({ channels });
    const svc = new BillingSatelliteNotifyService(moduleRef as never);
    await expect(svc.afterModuleChange("org-1")).resolves.toBe(true);
    expect(bindSync.syncForOrg).toHaveBeenCalled();
  });

  it("returns false for empty organizationId", async () => {
    const bindSync = { syncForOrg: jest.fn() };
    const get = jest.fn().mockReturnValue(bindSync);
    const svc = new BillingSatelliteNotifyService({ get } as never);
    await expect(svc.afterModuleChange("  ")).resolves.toBe(false);
    expect(get).not.toHaveBeenCalled();
    expect(bindSync.syncForOrg).not.toHaveBeenCalled();
  });
});
