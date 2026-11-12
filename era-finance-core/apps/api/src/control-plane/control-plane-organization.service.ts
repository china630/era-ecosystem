import { Injectable } from "@nestjs/common";
import { BillingStatus } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

/** Legacy finance DB organization fields used when orchestrator entitlement check is unavailable. */
@Injectable()
export class ControlPlaneOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async findLegacyBillingStatus(
    organizationId: string,
  ): Promise<BillingStatus | undefined> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingStatus: true },
    });
    return org?.billingStatus;
  }
}
