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
});
