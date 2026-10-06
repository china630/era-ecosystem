import { BadRequestException } from "@nestjs/common";
import { WorkforceSatelliteRoleCatalogService } from "./workforce-satellite-role-catalog.service";

describe("WorkforceSatelliteRoleCatalogService", () => {
  const prisma = {
    satelliteRoleCatalog: {
      upsert: jest.fn(async ({ create }: { create: { code: string } }) => create),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const endpoints = { resolveEndpoint: jest.fn() };
  const svc = new WorkforceSatelliteRoleCatalogService(
    prisma as never,
    endpoints as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("upsert keeps the satellite code as sent", async () => {
    await svc.upsert("org1", "industry_hotel_pms", {
      code: " Housekeeper ",
      name: " Maid ",
      active: true,
    });

    expect(prisma.satelliteRoleCatalog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_satelliteKey_code: {
            organizationId: "org1",
            satelliteKey: "industry_hotel_pms",
            code: "Housekeeper",
          },
        },
        create: expect.objectContaining({ name: "Maid", active: true }),
      }),
    );
  });

  it("assertAssignable rejects a code missing from a filled catalog", async () => {
    prisma.satelliteRoleCatalog.findFirst.mockResolvedValue(null);
    prisma.satelliteRoleCatalog.count.mockResolvedValue(3);

    await expect(
      svc.assertAssignable("org1", "industry_clinic", "RECEPTION"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(endpoints.resolveEndpoint).not.toHaveBeenCalled();
  });

  it("a full snapshot hides codes the satellite no longer lists", async () => {
    await svc.replaceSnapshot(
      "org1",
      "industry_hotel_pms",
      [{ code: "Housekeeper", name: "Housekeeper", active: true }],
      { replaceMissing: true },
    );

    expect(prisma.satelliteRoleCatalog.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org1",
        satelliteKey: "industry_hotel_pms",
        code: { notIn: ["Housekeeper"] },
      },
      data: { active: false },
    });
  });

  it("a single role push does not hide the other roles", async () => {
    await svc.replaceSnapshot("org1", "industry_hotel_pms", [
      { code: "NightAuditor", name: "Night auditor", active: true },
    ]);

    expect(prisma.satelliteRoleCatalog.updateMany).not.toHaveBeenCalled();
  });
});
