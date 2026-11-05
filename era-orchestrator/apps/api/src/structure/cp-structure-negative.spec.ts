import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { StructureService } from "./structure.service";

describe("CP-STRUCTURE negative paths", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-0000000000u1";
  const moduleRef = { get: jest.fn().mockReturnValue(undefined) };

  it("assertOwner rejects when access control denies", async () => {
    const access = {
      assertOwnerForBilling: jest
        .fn()
        .mockRejectedValue(
          new ForbiddenException({ code: "BILLING_OWNER_ONLY" }),
        ),
    };
    const prisma = {};
    const svc = new StructureService(
      prisma as never,
      access as never,
      moduleRef as never,
    );
    await expect(svc.assertOwner(userId, orgId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("assertMember rejects missing membership", async () => {
    const prisma = {
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const svc = new StructureService(
      prisma as never,
      { assertOwnerForBilling: jest.fn() } as never,
      moduleRef as never,
    );
    await expect(svc.assertMember(userId, orgId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("updateOutlet rejects foreign outlet", async () => {
    const access = {
      assertOwnerForBilling: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      commercialOutlet: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const svc = new StructureService(
      prisma as never,
      access as never,
      moduleRef as never,
    );
    await expect(
      svc.updateOutlet(userId, orgId, "00000000-0000-4000-8000-0000000000o1", {
        name: "x",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
