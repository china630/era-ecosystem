import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookingAppointmentStatus } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";
import { PlatformAuditService } from "../platform-audit.service";
import { PlatformIdempotencyService } from "../platform-idempotency.service";

const ENTITLEMENT = "platform_booking";

export type CreateSlotInput = {
  resourceKey: string;
  resourceName?: string;
  startsAt: string;
  endsAt: string;
  capacity?: number;
};

export type CreateAppointmentInput = {
  slotId?: string;
  resourceKey?: string;
  customerRef: string;
  customerPhone?: string;
  customerName?: string;
  scheduledAt: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly audit: PlatformAuditService,
    private readonly idempotency: PlatformIdempotencyService,
  ) {}

  private async dispatchWebhook(
    organizationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const url = process.env.PLATFORM_BOOKING_WEBHOOK_URL;
    if (!url) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, event, payload }),
    }).catch(() => undefined);
  }

  async createSlots(organizationId: string, body: CreateSlotInput) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Invalid slot dates");
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }
    const resource = await this.prisma.bookableResource.upsert({
      where: {
        organizationId_resourceKey: {
          organizationId,
          resourceKey: body.resourceKey,
        },
      },
      create: {
        organizationId,
        resourceKey: body.resourceKey,
        name: body.resourceName ?? body.resourceKey,
      },
      update: { name: body.resourceName ?? body.resourceKey },
    });
    const slot = await this.prisma.bookingSlot.create({
      data: {
        organizationId,
        resourceId: resource.id,
        startsAt,
        endsAt,
        capacity: body.capacity ?? 1,
      },
    });
    return { resource, slot };
  }

  async createAppointment(
    organizationId: string,
    body: CreateAppointmentInput,
    idempotencyKey?: string,
  ) {
    this.idempotency.assertLiveMode();
    return this.idempotency.run(
      organizationId,
      "booking.appointment",
      idempotencyKey,
      async () => this.createAppointmentCore(organizationId, body),
    );
  }

  private async createAppointmentCore(
    organizationId: string,
    body: CreateAppointmentInput,
  ) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("Invalid scheduledAt");
    }
    let slotId = body.slotId ?? null;
    let resourceId: string | null = null;
    if (slotId) {
      const slot = await this.prisma.bookingSlot.findFirst({
        where: { id: slotId, organizationId },
      });
      if (!slot) throw new NotFoundException("Slot not found");
      if (slot.bookedCount >= slot.capacity) {
        throw new BadRequestException("Slot is full");
      }
      resourceId = slot.resourceId;
      await this.prisma.bookingSlot.update({
        where: { id: slot.id },
        data: { bookedCount: { increment: 1 } },
      });
    } else if (body.resourceKey) {
      const resource = await this.prisma.bookableResource.findUnique({
        where: {
          organizationId_resourceKey: {
            organizationId,
            resourceKey: body.resourceKey,
          },
        },
      });
      if (!resource) throw new NotFoundException("Resource not found");
      resourceId = resource.id;
    }
    const appointment = await this.prisma.bookingAppointment.create({
      data: {
        organizationId,
        slotId,
        resourceId,
        customerRef: body.customerRef,
        customerPhone: body.customerPhone ?? null,
        customerName: body.customerName ?? null,
        scheduledAt,
        status: BookingAppointmentStatus.CONFIRMED,
        metadata: (body.metadata ?? {}) as object,
      },
    });
    await this.audit.log({
      organizationId,
      addonSlug: ENTITLEMENT,
      action: "appointment.created",
      payload: { appointmentId: appointment.id },
    });
    await this.dispatchWebhook(organizationId, "appointment.created", {
      appointmentId: appointment.id,
      customerRef: body.customerRef,
    });
    return { appointment, mode: "live" };
  }

  async cancelAppointment(
    organizationId: string,
    appointmentId: string,
    reason?: string,
    idempotencyKey?: string,
  ) {
    this.idempotency.assertLiveMode();
    return this.idempotency.run(
      organizationId,
      "booking.cancel",
      idempotencyKey,
      async () => {
        await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
        const appt = await this.prisma.bookingAppointment.findFirst({
          where: { id: appointmentId, organizationId },
        });
        if (!appt) throw new NotFoundException("Appointment not found");
        if (appt.status === BookingAppointmentStatus.CANCELLED) {
          return { appointment: appt, alreadyCancelled: true };
        }
        const metadata = {
          ...(typeof appt.metadata === "object" && appt.metadata
            ? (appt.metadata as Record<string, unknown>)
            : {}),
          cancelReason: reason ?? "customer_request",
          cancelPolicy: "free_until_24h",
        };
        const updated = await this.prisma.bookingAppointment.update({
          where: { id: appt.id },
          data: {
            status: BookingAppointmentStatus.CANCELLED,
            metadata: metadata as object,
          },
        });
        if (appt.slotId) {
          await this.prisma.bookingSlot.update({
            where: { id: appt.slotId },
            data: { bookedCount: { decrement: 1 } },
          });
        }
        await this.audit.log({
          organizationId,
          addonSlug: ENTITLEMENT,
          action: "appointment.cancelled",
          payload: { appointmentId, reason },
        });
        await this.dispatchWebhook(organizationId, "appointment.cancelled", {
          appointmentId,
          reason,
        });
        return { appointment: updated, mode: "live" };
      },
    );
  }

  async listSlots(organizationId: string, resourceKey?: string) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const key = resourceKey?.trim();
    const slots = await this.prisma.bookingSlot.findMany({
      where: {
        organizationId,
        ...(key ? { resource: { resourceKey: key } } : {}),
      },
      include: { resource: true },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
    return { slots };
  }
}