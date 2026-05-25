import { Injectable } from "@nestjs/common";

const ENTITLEMENT = "platform_booking";

@Injectable()
export class BookingService {
  private async assertEntitlement(_organizationId: string): Promise<void> {
    // TODO(CP-B3): assert organization_modules includes ENTITLEMENT
    void ENTITLEMENT;
  }

  async createSlots(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }

  async createAppointment(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }
}
