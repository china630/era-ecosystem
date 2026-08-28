import { Body, Controller, Get, Headers, Post, Query } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { SubscriptionAccessService } from "./subscription-access.service";
import { TrialProvisionService } from "./trial-provision.service";

type ProvisionTrialBody = {
  organizationId: string;
  organizationCreatedAt: string;
};

@Public()
@Controller("internal/v1/subscription")
export class InternalSubscriptionController {
  constructor(
    private readonly access: SubscriptionAccessService,
    private readonly trialProvision: TrialProvisionService,
  ) {}

  private guard(auth?: string, xToken?: string) {
    assertMatchingServiceToken(auth, xToken);
  }

  @Post("provision-trial")
  async provisionTrial(
    @Body() body: ProvisionTrialBody,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    const signupAt = new Date(body.organizationCreatedAt);
    return this.trialProvision.provisionOrgTrial(body.organizationId, signupAt);
  }

  @Get("snapshot")
  async snapshot(
    @Query("organizationId") organizationId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    const snap = await this.access.getOrganizationSnapshot(organizationId);
    return {
      ...snap,
      expiresAt: snap.expiresAt?.toISOString() ?? null,
    };
  }
}
