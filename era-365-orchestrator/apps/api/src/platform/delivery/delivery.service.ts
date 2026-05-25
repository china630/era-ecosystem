import { Injectable } from "@nestjs/common";

const ENTITLEMENT = "platform_delivery";

@Injectable()
export class DeliveryService {
  private async assertEntitlement(_organizationId: string): Promise<void> {
    // TODO(CP-B8): assert organization_modules includes ENTITLEMENT
    void ENTITLEMENT;
  }

  async createShipment(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }
}
