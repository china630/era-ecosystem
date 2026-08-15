import { Injectable } from "@nestjs/common";
import { TariffTier } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { billingPeriodKeyBaku } from "../billing/baku-billing.util";
import { resolveNewOrganizationTrialSubscription } from "./trial-package.util";

@Injectable()
export class TrialProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async provisionOrgTrial(
    organizationId: string,
    signupAt: Date,
  ): Promise<{ ok: true; alreadyExists: boolean }> {
    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (existing) {
      return { ok: true, alreadyExists: true };
    }

    const trialPeriodDays = await this.systemConfig.getTrialPeriodDays();

    await this.prisma.$transaction(async (tx) => {
      const trial = await resolveNewOrganizationTrialSubscription(
        tx,
        signupAt,
        trialPeriodDays,
      );
      await tx.organizationSubscription.create({
        data: {
          organizationId,
          currentTier: TariffTier.TIER_0,
          activeModules: trial.activeModules,
          isTrial: true,
          trialExpiresAt: trial.expiresAt,
          expiresAt: trial.expiresAt,
          billingPeriodKey: billingPeriodKeyBaku(signupAt),
          customConfig: trial.customConfig,
        },
      });
      await tx.organization.update({
        where: { id: organizationId },
        data: { activeModules: trial.activeModules },
      });
    });

    return { ok: true, alreadyExists: false };
  }
}
