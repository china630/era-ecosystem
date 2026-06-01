import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwnerForBilling(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!membership || membership.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: "BILLING_OWNER_ONLY",
        message: "Billing is only available to the organization owner.",
      });
    }
  }

  async assertCurrentUserIsOwner(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.assertOwnerForBilling(userId, organizationId);
  }
}
