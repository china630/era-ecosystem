import { Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    organizationId: string;
    addonSlug: string;
    action: string;
    idempotencyKey?: string;
    payload?: Record<string, unknown>;
  }) {
    return this.prisma.platformAuditLog.create({
      data: {
        organizationId: input.organizationId,
        addonSlug: input.addonSlug,
        action: input.action,
        idempotencyKey: input.idempotencyKey ?? null,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
