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

  const svc = new WorkforceRoleTemplateService(
    prisma as never,
    scope as never,
    audit as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("resolveRole returns template default when present", async () => {
    prisma.satelliteRoleTemplate.findFirst.mockResolvedValue({
      satelliteRole: "DOCTOR",
    });

    await expect(
      svc.resolveRole("pos1", "industry_clinic"),
    ).resolves.toBe("DOCTOR");
  });

  it("resolveRole falls back to Nafta seed pattern for therapist", async () => {
    prisma.satelliteRoleTemplate.findFirst.mockResolvedValue(null);
    prisma.workforcePosition.findUnique.mockResolvedValue({
      name: "Therapist",
    });

    await expect(
      svc.resolveRole("pos1", "industry_clinic"),
    ).resolves.toBe("DOCTOR");
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
