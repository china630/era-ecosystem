import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { parseNetworkDocumentsSettings } from "./network-settings.util";

@Injectable()
export class NetworkTenantMatchService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecipientOrgForCounterparty(
    issuerOrgId: string,
    counterpartyId: string,
  ): Promise<{ recipientOrgId: string } | null> {
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId: issuerOrgId },
      select: { taxIdBlindIndex: true },
    });
    if (!cp?.taxIdBlindIndex) return null;
    const recipient = await this.prisma.organization.findFirst({
      where: {
        taxIdBlindIndex: cp.taxIdBlindIndex,
        id: { not: issuerOrgId },
        isDeleted: false,
      },
      select: { id: true, settings: true },
    });
    if (!recipient) return null;
    if (!this.acceptsInbound(recipient.settings)) return null;
    return { recipientOrgId: recipient.id };
  }

  acceptsInbound(settings: unknown): boolean {
    return parseNetworkDocumentsSettings(settings).acceptInbound === true;
  }
}
