import { Injectable, Logger } from "@nestjs/common";
import { CounterpartyLegalForm } from "@erafinance/database";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import { mapHubCompanyToDirectory } from "../data-hub/hub-company-map";

export type DirectoryUpsertInput = {
  taxId: string;
  name: string;
  legalAddress?: string | null;
  phone?: string | null;
  directorName?: string | null;
  legalForm?: CounterpartyLegalForm | null;
};

/**
 * Company directory by VÖEN — read-through to era-data-hub (Phase 2).
 * Local GlobalCompanyDirectory table and upserts removed.
 */
@Injectable()
export class GlobalCompanyDirectoryService {
  private readonly logger = new Logger(GlobalCompanyDirectoryService.name);

  constructor(private readonly dataHub: DataHubClientService) {}

  /** No-op: company registry writes belong to data-hub. */
  scheduleUpsert(_input: DirectoryUpsertInput): void {
    // Intentionally empty — Finance no longer owns global company SoR.
  }

  /** @deprecated Local upsert removed; kept as no-op for call-site compatibility. */
  async upsert(_input: DirectoryUpsertInput): Promise<void> {
    this.logger.debug("GlobalCompanyDirectory upsert skipped (data-hub SoR)");
  }

  async findByTaxId(taxId: string) {
    const id = taxId.trim();
    if (!/^\d{10}$/.test(id)) {
      return null;
    }
    if (!this.dataHub.isEnabled()) {
      return null;
    }
    const remote = await this.dataHub.getCompanyByVoen(id);
    if (!remote) return null;
    const mapped = mapHubCompanyToDirectory(remote);
    if (!mapped.taxId) return null;
    return {
      taxId: mapped.taxId,
      name: mapped.name,
      legalAddress: mapped.legalAddress,
      phone: mapped.phone,
      directorName: mapped.directorName,
      legalForm: null as CounterpartyLegalForm | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
