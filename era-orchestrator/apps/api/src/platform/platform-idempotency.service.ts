import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlatformIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    organizationId: string,
    scope: string,
    idempotencyKey: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!idempotencyKey?.trim()) {
      return fn();
    }
    const key = idempotencyKey.trim();
    const existing = await this.prisma.platformIdempotencyRecord.findUnique({
      where: {
        organizationId_scope_idempotencyKey: {
          organizationId,
          scope,
          idempotencyKey: key,
        },
      },
    });
    if (existing?.responseJson) {
      return existing.responseJson as T;
    }
    const result = await fn();
    await this.prisma.platformIdempotencyRecord.upsert({
      where: {
        organizationId_scope_idempotencyKey: {
          organizationId,
          scope,
          idempotencyKey: key,
        },
      },
      create: {
        organizationId,
        scope,
        idempotencyKey: key,
        responseJson: result as Prisma.InputJsonValue,
      },
      update: {
        responseJson: result as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  assertLiveMode() {
    const mode = (process.env.PLATFORM_ADDONS_MODE ?? "live").toLowerCase();
    if (mode !== "live") {
      throw new ConflictException("Platform add-ons require PLATFORM_ADDONS_MODE=live");
    }
  }
}
