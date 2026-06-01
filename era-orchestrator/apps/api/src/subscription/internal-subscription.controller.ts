import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { TariffTier } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { billingPeriodKeyBaku } from "../billing/baku-billing.util";
import { resolveNewOrganizationTrialSubscription } from "./trial-package.util";
import { SubscriptionAccessService } from "./subscription-access.service";

type ProvisionTrialBody = {
  organizationId: string;
  organizationCreatedAt: string;
};

@Controller("internal/v1/subscription")
export class InternalSubscriptionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
  ) {}

  @Post("provision-trial")
  async provisionTrial(@Body() body: ProvisionTrialBody) {
    const signupAt = new Date(body.organizationCreatedAt);
    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: body.organizationId },
    });
    if (existing) {
      return { ok: true as const, alreadyExists: true };
    }

    await this.prisma.$transaction(async (tx) => {
      const trial = await resolveNewOrganizationTrialSubscription(tx, signupAt);
      await tx.organizationSubscription.create({
        data: {
          organizationId: body.organizationId,
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
        where: { id: body.organizationId },
        data: { activeModules: trial.activeModules },
      });
    });

    return { ok: true as const, alreadyExists: false };
  }

  @Get("snapshot")
  async snapshot(@Query("organizationId") organizationId: string) {
    const snap = await this.access.getOrganizationSnapshot(organizationId);
    return {
      ...snap,
      expiresAt: snap.expiresAt?.toISOString() ?? null,
    };
  }
}
