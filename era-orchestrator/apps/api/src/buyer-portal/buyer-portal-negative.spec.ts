import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BuyerPortalService } from "./buyer-portal.service";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Negative coverage for BuyerPortalService.invite VÖEN gate
 * (real service method; prisma mocked so short VÖEN never hits DB).
 */
describe("BuyerPortalService invite negatives", () => {
  function makeService(prismaOverrides?: Partial<PrismaService>) {
    const prisma = {
      buyerPortalAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
      },
      buyerOrgGrant: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ...prismaOverrides,
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    return { svc: new BuyerPortalService(prisma, config), prisma };
  }

  it("rejects short VÖEN via invite()", async () => {
    const { svc, prisma } = makeService();
    await expect(
      svc.invite({
        organizationId: "11111111-1111-4111-8111-111111111111",
        email: "buyer@example.com",
        voen: "123",
        financeCounterpartyId: "cp-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("accepts 10-digit VÖEN past the gate (then fails on missing org)", async () => {
    const { svc, prisma } = makeService();
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      svc.invite({
        organizationId: "11111111-1111-4111-8111-111111111111",
        email: "buyer@example.com",
        voen: "1234567890",
        financeCounterpartyId: "cp-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.organization.findUnique).toHaveBeenCalled();
  });
});
