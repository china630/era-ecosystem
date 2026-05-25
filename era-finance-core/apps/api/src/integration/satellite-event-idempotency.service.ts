import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { SatelliteDispatchResult } from "./satellite-event-dispatch.service";

@Injectable()
export class SatelliteEventIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async findExisting(
    organizationId: string,
    correlationId: string,
  ): Promise<{
    transactionId: string | null;
    invoiceId: string | null;
    resultJson: unknown;
  } | null> {
    const row = await this.prisma.satelliteEventProcessed.findUnique({
      where: {
        organizationId_correlationId: { organizationId, correlationId },
      },
    });
    if (!row) return null;
    return {
      transactionId: row.transactionId,
      invoiceId: row.invoiceId,
      resultJson: row.resultJson,
    };
  }

  async record(
    organizationId: string,
    correlationId: string,
    eventType: string,
    result: SatelliteDispatchResult,
  ): Promise<void> {
    await this.prisma.satelliteEventProcessed.create({
      data: {
        organizationId,
        correlationId,
        eventType,
        transactionId: result.transactionId ?? null,
        invoiceId: result.invoiceId ?? null,
        resultJson: (result.meta ?? {}) as object,
      },
    });
  }
}
