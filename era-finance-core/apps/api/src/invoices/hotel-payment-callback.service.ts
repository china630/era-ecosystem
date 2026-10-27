import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { HotelPaymentCallbackStatus, InvoiceStatus, Prisma } from "@prisma/client";
import {
  PEER_SATELLITE_HOTEL,
  resolvePeerSatelliteBaseUrl,
  resolveSatelliteEventServiceToken,
} from "@era/satellite-kit";
import { PrismaService } from "../prisma/prisma.service";

const MAX_ATTEMPTS = 12;

export type HotelPaymentCallbackInput = {
  organizationId: string;
  folioId: string;
  invoiceId: string;
  paymentId: string;
  amountAzn: number;
  fullyPaid: boolean;
};

@Injectable()
export class HotelPaymentCallbackService {
  private readonly logger = new Logger(HotelPaymentCallbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueue durable row then attempt immediate delivery (fire-and-forget HTTP).
   * Never throws into the payment path.
   */
  enqueueAndDeliver(input: HotelPaymentCallbackInput): void {
    void this.enqueueAndDeliverAsync(input).catch((e) => {
      this.logger.warn(
        `Hotel payment callback enqueue failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
  }

  async enqueueAndDeliverAsync(input: HotelPaymentCallbackInput): Promise<void> {
    const amount = new Prisma.Decimal(input.amountAzn.toFixed(4));
    const row = await this.prisma.hotelPaymentCallbackOutbox.upsert({
      where: {
        organizationId_folioId_paymentId: {
          organizationId: input.organizationId,
          folioId: input.folioId,
          paymentId: input.paymentId,
        },
      },
      create: {
        organizationId: input.organizationId,
        folioId: input.folioId,
        invoiceId: input.invoiceId,
        paymentId: input.paymentId,
        amountAzn: amount,
        fullyPaid: input.fullyPaid,
        status: HotelPaymentCallbackStatus.PENDING,
        nextAttemptAt: new Date(),
      },
      update: {
        invoiceId: input.invoiceId,
        amountAzn: amount,
        fullyPaid: input.fullyPaid,
        status: HotelPaymentCallbackStatus.PENDING,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
    await this.deliverOne(row.id);
  }

  async deliverOne(outboxId: string): Promise<boolean> {
    const row = await this.prisma.hotelPaymentCallbackOutbox.findUnique({
      where: { id: outboxId },
    });
    if (!row || row.status === HotelPaymentCallbackStatus.DONE) return true;

    const token = resolveSatelliteEventServiceToken();
    if (!token) {
      await this.markFailure(row.id, row.attempts, "SATELLITE_EVENT_SERVICE_TOKEN missing");
      return false;
    }

    let base: string;
    try {
      const peer = await resolvePeerSatelliteBaseUrl({
        organizationId: row.organizationId,
        satelliteKey: PEER_SATELLITE_HOTEL,
      });
      base = peer.baseUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.markFailure(row.id, row.attempts, `peer URL: ${msg}`);
      return false;
    }

    try {
      const res = await fetch(`${base}/api/internal/v1/city-ledger/payment-applied`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folioId: row.folioId,
          invoiceId: row.invoiceId,
          paymentId: row.paymentId,
          amount: Number(row.amountAzn),
          currency: "AZN",
          fullyPaid: row.fullyPaid,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        await this.markFailure(
          row.id,
          row.attempts,
          `HTTP ${res.status} ${detail}`.slice(0, 400),
        );
        return false;
      }
      await this.prisma.hotelPaymentCallbackOutbox.update({
        where: { id: row.id },
        data: {
          status: HotelPaymentCallbackStatus.DONE,
          lastError: null,
          attempts: row.attempts + 1,
        },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.markFailure(row.id, row.attempts, msg.slice(0, 400));
      return false;
    }
  }

  private async markFailure(
    id: string,
    attempts: number,
    lastError: string,
  ): Promise<void> {
    const nextAttempts = attempts + 1;
    const dead = nextAttempts >= MAX_ATTEMPTS;
    const backoffMin = Math.min(60, Math.pow(2, Math.min(nextAttempts, 6)));
    await this.prisma.hotelPaymentCallbackOutbox.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        lastError,
        status: dead
          ? HotelPaymentCallbackStatus.DEAD
          : HotelPaymentCallbackStatus.PENDING,
        nextAttemptAt: new Date(Date.now() + backoffMin * 60_000),
      },
    });
    this.logger.warn(
      `Hotel payment callback ${dead ? "DEAD" : "retry"} id=${id}: ${lastError}`,
    );
  }

  /** Retry pending outbox rows. */
  @Cron("*/15 * * * *", { timeZone: "Asia/Baku" })
  async processPendingOutbox(): Promise<void> {
    if (process.env.ERA_HOTEL_PAYMENT_CALLBACK_CRON === "0") return;
    const due = await this.prisma.hotelPaymentCallbackOutbox.findMany({
      where: {
        status: HotelPaymentCallbackStatus.PENDING,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: 50,
    });
    for (const row of due) {
      await this.deliverOne(row.id);
    }
  }

  /**
   * Reconcile safety net for fully PAID hotel-sourced invoices with no successful
   * callback yet. Never invents a second payment when allocate/bank match already
   * wrote DONE/PENDING outbox rows (those paths own the paymentId).
   */
  @Cron("5 * * * *", { timeZone: "Asia/Baku" })
  async reconcilePaidHotelInvoices(): Promise<void> {
    if (process.env.ERA_HOTEL_PAYMENT_CALLBACK_CRON === "0") return;
    const invoices = await this.prisma.invoice.findMany({
      where: {
        sourceFolioId: { not: null },
        status: InvoiceStatus.PAID,
        paidAmount: { gt: 0 },
      },
      select: {
        id: true,
        organizationId: true,
        sourceFolioId: true,
        paidAmount: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    for (const inv of invoices) {
      if (!inv.sourceFolioId) continue;

      const existing = await this.prisma.hotelPaymentCallbackOutbox.findFirst({
        where: {
          organizationId: inv.organizationId,
          invoiceId: inv.id,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (existing?.status === HotelPaymentCallbackStatus.DONE) continue;

      if (existing?.status === HotelPaymentCallbackStatus.PENDING) {
        await this.deliverOne(existing.id);
        continue;
      }

      if (existing?.status === HotelPaymentCallbackStatus.DEAD) {
        await this.prisma.hotelPaymentCallbackOutbox.update({
          where: { id: existing.id },
          data: {
            status: HotelPaymentCallbackStatus.PENDING,
            nextAttemptAt: new Date(),
            lastError: null,
          },
        });
        await this.deliverOne(existing.id);
        continue;
      }

      // No outbox row at all (e.g. env/token gap before peer-url wave) — one stable id.
      await this.enqueueAndDeliverAsync({
        organizationId: inv.organizationId,
        folioId: inv.sourceFolioId,
        invoiceId: inv.id,
        paymentId: `reconcile:${inv.id}`,
        amountAzn: Number(inv.paidAmount),
        fullyPaid: true,
      });
    }
  }
}
