import { Injectable, Logger } from "@nestjs/common";

/**
 * @deprecated Plan C: CP WorkforceProvisionService publishes STAFF_* events.
 * Kept as injectable no-op for backward-compatible module wiring.
 */
@Injectable()
export class HrStaffProvisioningService {
  private readonly logger = new Logger(HrStaffProvisioningService.name);

  async emitProvisioned(): Promise<void> {
    this.logger.debug("emitProvisioned skipped — use CP workforce hire");
  }

  async emitDeactivated(): Promise<void> {
    this.logger.debug("emitDeactivated skipped — use CP workforce terminate");
  }

  shouldDeactivate(): boolean {
    return false;
  }
}
