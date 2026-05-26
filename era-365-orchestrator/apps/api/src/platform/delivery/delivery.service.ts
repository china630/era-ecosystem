import { BadRequestException, Injectable } from "@nestjs/common";
import { PlatformShipmentStatus, Prisma } from "@era365/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";

const ENTITLEMENT = "platform_delivery";

export type CreateShipmentInput = {
  sourceEntityType: string;
  sourceEntityId: string;
  externalRef?: string;
  recipientPhone?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
  ) {}

  async createShipment(organizationId: string, body: CreateShipmentInput) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);

    const sourceEntityType = body.sourceEntityType?.trim();
    const sourceEntityId = body.sourceEntityId?.trim();
    if (!sourceEntityType || !sourceEntityId) {
      throw new BadRequestException(
        "sourceEntityType and sourceEntityId are required",
      );
    }

    const trackingToken = randomBytes(16).toString("hex");

    const shipment = await this.prisma.platformShipment.create({
      data: {
        organizationId,
        externalRef: body.externalRef?.trim() ?? null,
        trackingToken,
        status: PlatformShipmentStatus.CREATED,
        sourceEntityType,
        sourceEntityId,
        recipientPhone: body.recipientPhone?.trim() ?? null,
        metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return {
      id: shipment.id,
      trackingToken: shipment.trackingToken,
      status: shipment.status,
      sourceEntityType: shipment.sourceEntityType,
      sourceEntityId: shipment.sourceEntityId,
      externalRef: shipment.externalRef,
      recipientPhone: shipment.recipientPhone,
    };
  }
}
