import { Injectable } from "@nestjs/common";

const ENTITLEMENT = "platform_loyalty";

@Injectable()
export class LoyaltyService {
  private async assertEntitlement(_organizationId: string): Promise<void> {
    // TODO(CP-B6): assert organization_modules includes ENTITLEMENT
    void ENTITLEMENT;
  }

  async createPromotion(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }
}
