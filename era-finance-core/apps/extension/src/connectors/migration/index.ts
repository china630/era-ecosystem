import type { PortalConnector, PortalFlowDescriptor } from "../types";
import { detectMigrationAuthState } from "./auth-detect";

export type MigrationPrefillPayload = {
  schemaVersion?: number;
  person?: {
    fullName?: string;
    passportNumber?: string | null;
    nationality?: string;
    visaExpiry?: string | null;
  };
  note?: string;
};

export const migrationConnector: PortalConnector = {
  id: "migration",
  entitlement: "hr_full",
  matches(url: URL) {
    return (
      url.hostname.includes("migration.gov.az") ||
      url.hostname.includes("portal.migration.example")
    );
  },
  detectAuthState(doc: Document) {
    return detectMigrationAuthState(doc);
  },
  async detectActiveVoen() {
    return null;
  },
  listFlows(): PortalFlowDescriptor[] {
    return [
      {
        id: "registration",
        titleKey: "extension.portal.flowMigration",
        entitlement: "hr_full",
      },
    ];
  },
};
