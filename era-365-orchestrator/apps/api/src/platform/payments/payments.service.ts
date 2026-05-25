import { Injectable } from "@nestjs/common";

const ENTITLEMENT = "platform_payments";

@Injectable()
export class PaymentsService {
  private async assertEntitlement(_organizationId: string): Promise<void> {
    // TODO(CP-B5): assert organization_modules includes ENTITLEMENT
    void ENTITLEMENT;
  }

  async createPaymentLink(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }
}
