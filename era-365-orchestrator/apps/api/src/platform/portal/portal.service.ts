import { Injectable } from "@nestjs/common";

const ENTITLEMENT = "platform_portal";

@Injectable()
export class PortalService {
  private async assertEntitlement(_organizationId: string): Promise<void> {
    // TODO(CP-B4): assert organization_modules includes ENTITLEMENT
    void ENTITLEMENT;
  }

  async getLink(_token: string) {
    // TODO(CP-B4): resolve portal link by token (may be public)
    return { ok: true, stub: true };
  }

  async createLink(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }
}
