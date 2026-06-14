import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { SubscriptionAccessService } from "./subscription-access.service";
import { TrialProvisionService } from "./trial-provision.service";

type ProvisionTrialBody = {
  organizationId: string;
  organizationCreatedAt: string;
};

@Controller("internal/v1/subscription")
export class InternalSubscriptionController {
  constructor(
    private readonly access: SubscriptionAccessService,
    private readonly trialProvision: TrialProvisionService,
  ) {}

  @Post("provision-trial")
  async provisionTrial(@Body() body: ProvisionTrialBody) {
    const signupAt = new Date(body.organizationCreatedAt);
    return this.trialProvision.provisionOrgTrial(body.organizationId, signupAt);
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
