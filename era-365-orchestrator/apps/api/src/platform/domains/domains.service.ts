import { Injectable } from "@nestjs/common";

const ENTITLEMENT = "platform_domain";

@Injectable()
export class DomainsService {
  private async assertEntitlement(_organizationId: string): Promise<void> {
    // TODO(CP-B7): assert organization_modules includes ENTITLEMENT
    void ENTITLEMENT;
  }

  async createDomain(organizationId: string, _body: unknown) {
    await this.assertEntitlement(organizationId);
    return { ok: true, stub: true };
  }
}
