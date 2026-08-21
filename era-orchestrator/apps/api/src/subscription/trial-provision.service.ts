import { Injectable } from "@nestjs/common";
import { TariffTier } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { billingPeriodKeyBaku } from "../billing/baku-billing.util";
import { resolveNewOrganizationTrialSubscription } from "./trial-package.util";
import { licenseProvisionPlan, type DeploymentTopologyCode } from "./license-defaults";

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
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { deploymentTopology: true },
    });
    const topology = (org?.deploymentTopology ?? "SHARED") as DeploymentTopologyCode;
    const plan = licenseProvisionPlan(topology, signupAt, trialPeriodDays);

    await this.prisma.$transaction(async (tx) => {
      const trial = await resolveNewOrganizationTrialSubscription(
        tx,
        signupAt,
        trialPeriodDays,
      );
      const activeModules = plan.isTrial ? trial.activeModules : [];
      await tx.organizationSubscription.create({
        data: {
          organizationId,
          currentTier: TariffTier.TIER_0,
          activeModules,
          isTrial: plan.isTrial,
          trialExpiresAt: plan.expiresAt,
          expiresAt: plan.expiresAt,
          billingPeriodKey: billingPeriodKeyBaku(signupAt),
          customConfig: plan.isTrial
            ? trial.customConfig
            : { modules: [], licenseDefault: topology },
        },
      });
      await tx.organization.update({
        where: { id: organizationId },
        data: { activeModules },
      });
    });

    return { ok: true, alreadyExists: false };
  }
}
