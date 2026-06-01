import { Injectable } from "@nestjs/common";

@Injectable()
export class ActivityStreamEmitterService {
  async emitFromAuditMutation(_params: {
    organizationId: string | null;
    actorUserId: string | null;
    auditEntityType: string;
    entityId: string;
    httpMethod: string;
  }): Promise<void> {
    // CP billing: no ERP activity timeline.
  }

  async emitCustom(_params: {
    organizationId: string;
    entityType: string;
    entityId: string;
    actorUserId?: string | null;
    verb: string;
    summary: string;
    payload?: unknown;
  }): Promise<void> {
    // no-op on control plane
  }
}
