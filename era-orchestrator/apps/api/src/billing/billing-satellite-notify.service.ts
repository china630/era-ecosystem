import { Injectable, Logger } from "@nestjs/common";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";

/**
 * After `activeModules` mutations, push bind + runtime-config to satellites
 * (same path as F&B edition upgrade / Super-admin Sync). Best-effort: never
 * throws — billing commit already succeeded.
 */
@Injectable()
export class BillingSatelliteNotifyService {
  private readonly log = new Logger(BillingSatelliteNotifyService.name);

  constructor(private readonly bindSync: SatelliteOrgBindSyncService) {}

  async afterModuleChange(organizationId: string): Promise<boolean> {
    const org = organizationId?.trim();
    if (!org) return false;
    try {
      await this.bindSync.syncForOrg(org);
      return true;
    } catch (err) {
      this.log.warn(
        `Module-change Sync failed for ${org}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
