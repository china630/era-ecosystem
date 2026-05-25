import { Body, Controller, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "./referrals.service";

type AttachReferralBody = {
  organizationId: string;
  organizationCreatedAt: string;
  referralCode?: string | null;
};

@Controller("internal/v1/referrals")
export class InternalReferralsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
  ) {}

  @Post("attach-on-signup")
  async attachOnSignup(@Body() body: AttachReferralBody) {
    const createdAt = new Date(body.organizationCreatedAt);
    await this.prisma.$transaction(async (tx) => {
      await this.referrals.attachReferralOnSignupTx(tx, {
        organizationId: body.organizationId,
        organizationCreatedAt: createdAt,
        referralCode: body.referralCode,
      });
    });
    return { ok: true as const };
  }
}
