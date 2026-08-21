import { Injectable, Logger } from "@nestjs/common";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";

/**
 * Quiet module check for scheduled jobs — skip work when module off
 * (do not throw; do not post).
 */
@Injectable()
export class CronModuleGateService {
  private readonly logger = new Logger(CronModuleGateService.name);

  constructor(private readonly access: SubscriptionAccessService) {}

  async isModuleOn(
    organizationId: string,
    moduleKey: string,
  ): Promise<boolean> {
    try {
      return await this.access.hasModule(organizationId, moduleKey);
    } catch (e) {
      this.logger.warn(
        `Module gate check failed org=${organizationId} module=${moduleKey}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return false;
    }
  }

  /** Filter org ids to those entitled for moduleKey. */
  async filterEntitledOrgs(
    organizationIds: string[],
    moduleKey: string,
  ): Promise<string[]> {
    const out: string[] = [];
    for (const id of organizationIds) {
      if (await this.isModuleOn(id, moduleKey)) out.push(id);
    }
    return out;
  }
}
