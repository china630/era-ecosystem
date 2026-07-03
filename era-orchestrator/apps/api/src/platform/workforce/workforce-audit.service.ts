import { Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WorkforceAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    workforceScopeId?: string;
    globalPersonId?: string;
    cpEmploymentId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.workforceAuditLog.create({
      data: {
        organizationId: input.organizationId,
        workforceScopeId: input.workforceScopeId ?? null,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        globalPersonId: input.globalPersonId ?? null,
        cpEmploymentId: input.cpEmploymentId ?? null,
        payloadJson: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
