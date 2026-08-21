import { Injectable } from "@nestjs/common";
import { Prisma } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

export interface AuditAppendInput {
  entity: string;
  entityId: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  actorUserId: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  append(input: AuditAppendInput) {
    return this.prisma.auditLogEntry.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.beforeJson as Prisma.InputJsonValue | undefined,
        afterJson: input.afterJson as Prisma.InputJsonValue | undefined,
        actorUserId: input.actorUserId,
      },
    });
  }

  appendInTx(
    // Interactive tx from SatellitePrisma.$transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    input: AuditAppendInput,
  ) {
    return tx.auditLogEntry.create({
      data: {
        organizationId: this.bankOrg.bankOrgId,
        bankOrgId: this.bankOrg.bankOrgId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.beforeJson as Prisma.InputJsonValue | undefined,
        afterJson: input.afterJson as Prisma.InputJsonValue | undefined,
        actorUserId: input.actorUserId,
      },
    });
  }
}
