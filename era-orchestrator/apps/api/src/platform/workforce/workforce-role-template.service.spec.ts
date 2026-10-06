import { BadRequestException } from "@nestjs/common";
import { WorkforceRoleTemplateService } from "./workforce-role-template.service";

describe("WorkforceRoleTemplateService", () => {
  const prisma = {
    satelliteRoleTemplate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    workforcePosition: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const scope = {
    resolveScopeForCommercialOrg: jest.fn().mockResolvedValue({
      workforceScopeId: "scope1",
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const catalog = {
    assertAssignable: jest.fn(async (_org: string, _key: string, code: string) => {
      const trimmed = code.trim();
      if (trimmed === "INVALID_ROLE") {
        throw new BadRequestException({ code: "SATELLITE_ROLE_UNKNOWN" });
      }
      return trimmed;
    }),
  };

  const svc = new WorkforceRoleTemplateService(
    prisma as never,
    scope as never,
    audit as never,
    catalog as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("resolveRole returns template default when present", async () => {
    prisma.satelliteRoleTemplate.findFirst.mockResolvedValue({
      satelliteRole: "DOCTOR",
    });

    await expect(
      svc.resolveRole("pos1", "industry_clinic", "org1"),
    ).resolves.toBe("DOCTOR");
  });

  it("resolveRole refuses a position with no satellite role", async () => {
    prisma.satelliteRoleTemplate.findFirst.mockResolvedValue(null);

    await expect(
      svc.resolveRole("pos1", "industry_clinic", "org1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("upsert rejects invalid satellite role", async () => {
    prisma.workforcePosition.findFirst.mockResolvedValue({ id: "p1" });

    await expect(
      svc.upsert("org1", "u1", {
        positionId: "p1",
        satelliteKey: "industry_clinic",
        satelliteRole: "INVALID_ROLE",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
