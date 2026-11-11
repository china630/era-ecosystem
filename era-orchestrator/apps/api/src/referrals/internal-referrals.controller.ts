import { Body, Controller, Post } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";

type AttachReferralBody = {
  organizationId: string;
  organizationCreatedAt: string;
  referralCode?: string | null;
};

@Controller("internal/v1/referrals")
export class InternalReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Post("attach-on-signup")
  async attachOnSignup(@Body() body: AttachReferralBody) {
    const createdAt = new Date(body.organizationCreatedAt);
    await this.referrals.attachReferralOnSignup({
      organizationId: body.organizationId,
      organizationCreatedAt: createdAt,
      referralCode: body.referralCode,
    });
    return { ok: true as const };
  }
}
