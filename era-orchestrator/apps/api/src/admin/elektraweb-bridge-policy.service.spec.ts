import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ElektrawebBridgePolicyService } from "./elektraweb-bridge-policy.service";

const ORG = "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("ElektrawebBridgePolicyService.upsertClinicCutover", () => {
  const prisma = {
    organization: { findUnique: jest.fn() },
    satelliteEndpoint: { findMany: jest.fn() },
    clinicCutoverPolicy: { upsert: jest.fn() },
  };

  function svc() {
    return new ElektrawebBridgePolicyService(prisma as never);
  }

  function upsertRow(hotelOrganizationId: string | null) {
    return {
      organizationId: ORG,
      elektrawebDualRun: true,
      hotelOrganizationId,
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.organization.findUnique.mockResolvedValue({ id: ORG });
    prisma.clinicCutoverPolicy.upsert.mockImplementation(
      ({ create }: { create: { hotelOrganizationId: string | null } }) =>
        Promise.resolve(upsertRow(create.hotelOrganizationId)),
    );
  });

  it("allows hotelOrganizationId equal to this org when hotel PMS is enabled", async () => {
    prisma.satelliteEndpoint.findMany.mockResolvedValue([
      { satelliteKey: "industry_hotel_pms" },
      { satelliteKey: "industry_clinic" },
    ]);
    const row = await svc().upsertClinicCutover(ORG, {
      elektrawebDualRun: true,
      hotelOrganizationId: ORG,
    });
    expect(row.hotelOrganizationId).toBe(ORG);
    expect(prisma.clinicCutoverPolicy.upsert).toHaveBeenCalled();
  });

  it("rejects same UUID when this org has no hotel PMS endpoint", async () => {
    prisma.satelliteEndpoint.findMany.mockResolvedValue([
      { satelliteKey: "industry_clinic" },
    ]);
    await expect(
      svc().upsertClinicCutover(ORG, {
        elektrawebDualRun: true,
        hotelOrganizationId: ORG,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.clinicCutoverPolicy.upsert).not.toHaveBeenCalled();
  });

  it("rejects unknown hotelOrganizationId", async () => {
    prisma.organization.findUnique
      .mockResolvedValueOnce({ id: ORG })
      .mockResolvedValueOnce(null);
    await expect(
      svc().upsertClinicCutover(ORG, {
        elektrawebDualRun: true,
        hotelOrganizationId: OTHER,
      }),
    ).rejects.toMatchObject({
      message: "hotelOrganizationId not found",
    });
  });

  it("accepts a different existing hotel org", async () => {
    prisma.organization.findUnique
      .mockResolvedValueOnce({ id: ORG })
      .mockResolvedValueOnce({ id: OTHER });
    const row = await svc().upsertClinicCutover(ORG, {
      elektrawebDualRun: true,
      hotelOrganizationId: OTHER,
    });
    expect(row.hotelOrganizationId).toBe(OTHER);
  });

  it("404 when clinic org is missing", async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(
      svc().upsertClinicCutover(ORG, { elektrawebDualRun: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
