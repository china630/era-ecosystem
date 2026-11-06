import { ForbiddenException } from "@nestjs/common";
import { SatelliteChannelManagedBy } from "@era365/database";
import { SatelliteChannelsService } from "./satellite-channels.service";

describe("CP-CHANNELS negative paths", () => {
  const orgA = "00000000-0000-4000-8000-0000000000aa";
  const orgB = "00000000-0000-4000-8000-0000000000bb";

  it("acceptorDisable rejects when caller org is not the toOrg", async () => {
    const prisma = {
      organizationSatelliteChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ch1",
          fromOrgId: orgA,
          toOrgId: orgB,
          fromSatelliteKey: "industry_fnb_pos",
          toSatelliteKey: "industry_hotel_pms",
          kind: "FOLIO_POST",
          enabled: true,
          managedBy: SatelliteChannelManagedBy.PLATFORM,
          fromOrganization: { name: "A" },
          toOrganization: { name: "B" },
        }),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await expect(svc.acceptorDisable(orgA, "ch1", false)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "CHANNEL_ACCEPTOR_ONLY" }),
    });
    await expect(svc.acceptorDisable(orgA, "ch1", false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("acceptorDisable rejects re-enable after ACCEPTOR override", async () => {
    const prisma = {
      organizationSatelliteChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ch1",
          fromOrgId: orgA,
          toOrgId: orgB,
          fromSatelliteKey: "industry_fnb_pos",
          toSatelliteKey: "industry_hotel_pms",
          kind: "FOLIO_POST",
          enabled: false,
          managedBy: SatelliteChannelManagedBy.ACCEPTOR,
          fromOrganization: { name: "A" },
          toOrganization: { name: "B" },
        }),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await expect(svc.acceptorDisable(orgB, "ch1", true)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "CHANNEL_ACCEPTOR_CANNOT_ENABLE",
      }),
    });
  });

  it("isEnabled is false when row missing (fail-closed check)", async () => {
    const prisma = {
      organizationSatelliteChannel: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await expect(
      svc.isEnabled({
        fromOrgId: orgA,
        fromSatelliteKey: "industry_fnb_pos",
        toOrgId: orgB,
        toSatelliteKey: "industry_hotel_pms",
        kind: "FOLIO_POST",
      }),
    ).resolves.toBe(false);
  });

  it("OWN org sync creates REVENUE_EVENT to self finance_core", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgA,
          operatingMode: "STANDALONE",
          parentOrgId: null,
          revenueRouting: "OWN",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationSatelliteEntitlement: {
        findMany: jest.fn().mockResolvedValue([
          { satelliteKey: "industry_hotel_pms" },
          { satelliteKey: "finance_core" },
        ]),
        findUnique: jest.fn().mockImplementation(
          async ({
            where,
          }: {
            where: {
              organizationId_satelliteKey: {
                organizationId: string;
                satelliteKey: string;
              };
            };
          }) => {
            const { organizationId, satelliteKey } =
              where.organizationId_satelliteKey;
            if (
              organizationId === orgA &&
              satelliteKey === "industry_hotel_pms"
            ) {
              return { suspendedAt: null };
            }
            return null;
          },
        ),
      },
      organizationSatelliteChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
        delete: jest.fn(),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await svc.syncPlatformChannels(orgA);
    const revenueCreates = upsert.mock.calls.filter(
      (c: Array<{ create?: { kind?: string; toOrgId?: string } }>) =>
        c[0]?.create?.kind === "REVENUE_EVENT",
    );
    expect(revenueCreates.length).toBe(1);
    expect(revenueCreates[0][0].create).toMatchObject({
      fromOrgId: orgA,
      fromSatelliteKey: "industry_hotel_pms",
      toOrgId: orgA,
      toSatelliteKey: "finance_core",
      kind: "REVENUE_EVENT",
      managedBy: SatelliteChannelManagedBy.PLATFORM,
      enabled: true,
    });
  });

  it("PARENT dept sync creates REVENUE_EVENT to parent only (no self edge)", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgA,
          operatingMode: "DEPARTMENT",
          parentOrgId: orgB,
          revenueRouting: "PARENT",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationSatelliteEntitlement: {
        findMany: jest.fn().mockResolvedValue([
          { satelliteKey: "industry_clinic" },
          { satelliteKey: "finance_core" },
        ]),
        findUnique: jest.fn().mockImplementation(
          async ({
            where,
          }: {
            where: {
              organizationId_satelliteKey: {
                organizationId: string;
                satelliteKey: string;
              };
            };
          }) => {
            const { organizationId, satelliteKey } =
              where.organizationId_satelliteKey;
            if (
              organizationId === orgB &&
              satelliteKey === "industry_hotel_pms"
            ) {
              return { suspendedAt: null };
            }
            if (organizationId === orgB && satelliteKey === "finance_core") {
              return { suspendedAt: null };
            }
            return null;
          },
        ),
      },
      organizationSatelliteChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
        delete: jest.fn(),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await svc.syncPlatformChannels(orgA);
    const revenueCreates = upsert.mock.calls
      .map((c: Array<{ create?: Record<string, unknown> }>) => c[0]?.create)
      .filter((c) => c?.kind === "REVENUE_EVENT");
    expect(revenueCreates).toHaveLength(1);
    expect(revenueCreates[0]).toMatchObject({
      fromOrgId: orgA,
      fromSatelliteKey: "industry_clinic",
      toOrgId: orgB,
      toSatelliteKey: "finance_core",
    });
    expect(
      revenueCreates.some((c) => c?.toOrgId === orgA),
    ).toBe(false);
  });

  it("ACCEPTOR override is not re-enabled by PLATFORM sync", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const acceptorRow = {
      id: "ch-acc",
      fromOrgId: orgA,
      fromSatelliteKey: "industry_hotel_pms",
      toOrgId: orgA,
      toSatelliteKey: "finance_core",
      kind: "REVENUE_EVENT",
      enabled: false,
      managedBy: SatelliteChannelManagedBy.ACCEPTOR,
    };
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgA,
          operatingMode: "STANDALONE",
          parentOrgId: null,
          revenueRouting: "OWN",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationSatelliteEntitlement: {
        findMany: jest.fn().mockResolvedValue([
          { satelliteKey: "industry_hotel_pms" },
          { satelliteKey: "finance_core" },
        ]),
        findUnique: jest.fn().mockResolvedValue({ suspendedAt: null }),
      },
      organizationSatelliteChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(acceptorRow),
        upsert,
        delete: jest.fn(),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await svc.syncPlatformChannels(orgA);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("connect finance entitlement yields self REVENUE_EVENT on sync", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgA,
          operatingMode: "STANDALONE",
          parentOrgId: null,
          revenueRouting: "OWN",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationSatelliteEntitlement: {
        findMany: jest.fn().mockResolvedValue([
          { satelliteKey: "industry_retail" },
          { satelliteKey: "finance_core" },
        ]),
        findUnique: jest.fn().mockResolvedValue({ suspendedAt: null }),
      },
      organizationSatelliteChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
        delete: jest.fn(),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await svc.syncPlatformChannels(orgA);
    const revenue = upsert.mock.calls
      .map((c: Array<{ create?: Record<string, unknown> }>) => c[0]?.create)
      .filter((c) => c?.kind === "REVENUE_EVENT");
    expect(revenue).toEqual([
      expect.objectContaining({
        fromOrgId: orgA,
        fromSatelliteKey: "industry_retail",
        toOrgId: orgA,
        toSatelliteKey: "finance_core",
        kind: "REVENUE_EVENT",
      }),
    ]);
  });

  it("OPS_HANDOFF wholesale→retail desired when both entitlements live", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgA,
          operatingMode: "STANDALONE",
          parentOrgId: null,
          revenueRouting: "OWN",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationSatelliteEntitlement: {
        findMany: jest.fn().mockResolvedValue([
          { satelliteKey: "industry_wholesale" },
          { satelliteKey: "industry_retail" },
        ]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      organizationSatelliteChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
        delete: jest.fn(),
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await svc.syncPlatformChannels(orgA);
    const handoff = upsert.mock.calls
      .map((c: Array<{ create?: Record<string, unknown> }>) => c[0]?.create)
      .filter((c) => c?.kind === "OPS_HANDOFF");
    expect(handoff).toEqual([
      expect.objectContaining({
        fromOrgId: orgA,
        fromSatelliteKey: "industry_wholesale",
        toOrgId: orgA,
        toSatelliteKey: "industry_retail",
        kind: "OPS_HANDOFF",
      }),
    ]);
  });

  it("suspend finance_core drops PLATFORM revenue edges on re-sync; ACCEPTOR untouched", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const del = jest.fn().mockResolvedValue({});
    const platformRevenue = {
      id: "ch-plat",
      fromOrgId: orgA,
      fromSatelliteKey: "industry_hotel_pms",
      toOrgId: orgA,
      toSatelliteKey: "finance_core",
      kind: "REVENUE_EVENT",
      enabled: true,
      managedBy: SatelliteChannelManagedBy.PLATFORM,
    };
    const acceptorFolio = {
      id: "ch-acc-folio",
      fromOrgId: orgA,
      fromSatelliteKey: "industry_fnb_pos",
      toOrgId: orgA,
      toSatelliteKey: "industry_hotel_pms",
      kind: "FOLIO_POST",
      enabled: false,
      managedBy: SatelliteChannelManagedBy.ACCEPTOR,
    };
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: orgA,
          operatingMode: "STANDALONE",
          parentOrgId: null,
          revenueRouting: "OWN",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationSatelliteEntitlement: {
        // finance suspended → not in live keys
        findMany: jest.fn().mockResolvedValue([
          { satelliteKey: "industry_hotel_pms" },
          { satelliteKey: "industry_fnb_pos" },
        ]),
        findUnique: jest.fn().mockImplementation(
          async ({
            where,
          }: {
            where: {
              organizationId_satelliteKey: {
                organizationId: string;
                satelliteKey: string;
              };
            };
          }) => {
            const { satelliteKey } = where.organizationId_satelliteKey;
            if (satelliteKey === "industry_hotel_pms") {
              return { suspendedAt: null };
            }
            if (satelliteKey === "finance_core") {
              return { suspendedAt: new Date("2026-01-01") };
            }
            return null;
          },
        ),
      },
      organizationSatelliteChannel: {
        findMany: jest.fn().mockResolvedValue([platformRevenue]),
        findUnique: jest.fn().mockImplementation(
          async ({
            where,
          }: {
            where: {
              fromOrgId_fromSatelliteKey_toOrgId_toSatelliteKey_kind: {
                kind: string;
                fromSatelliteKey: string;
              };
            };
          }) => {
            const key =
              where.fromOrgId_fromSatelliteKey_toOrgId_toSatelliteKey_kind;
            if (key.kind === "REVENUE_EVENT") return null;
            if (key.fromSatelliteKey === "industry_fnb_pos") {
              return acceptorFolio;
            }
            return null;
          },
        ),
        upsert,
        delete: del,
      },
    };
    const svc = new SatelliteChannelsService(prisma as never);
    await svc.syncPlatformChannels(orgA);
    expect(del).toHaveBeenCalledWith({ where: { id: "ch-plat" } });
    const revenueUpserts = upsert.mock.calls.filter(
      (c: Array<{ create?: { kind?: string } }>) =>
        c[0]?.create?.kind === "REVENUE_EVENT",
    );
    expect(revenueUpserts).toHaveLength(0);
    // FOLIO/SETTLEMENT for F&B→hotel still desired; ACCEPTOR row skipped
    expect(
      upsert.mock.calls.some(
        (c: Array<{ create?: { kind?: string; managedBy?: string } }>) =>
          c[0]?.create?.kind === "FOLIO_POST",
      ),
    ).toBe(false);
  });
});

