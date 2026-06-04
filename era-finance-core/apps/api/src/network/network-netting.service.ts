import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LedgerType, UserRole } from "@erafinance/database";
import { NettingService } from "../accounting/netting.service";
import { PrismaService } from "../prisma/prisma.service";
import { NetworkTenantMatchService } from "./network-tenant-match.service";

@Injectable()
export class NetworkNettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: NetworkTenantMatchService,
    private readonly netting: NettingService,
  ) {}

  async previewForPartnerOrganization(
    organizationId: string,
    partnerOrganizationId: string,
    ledgerType: LedgerType = LedgerType.NAS,
  ) {
    const partner = await this.prisma.organization.findFirst({
      where: { id: partnerOrganizationId, isDeleted: false },
      select: { id: true, taxIdBlindIndex: true, name: true, settings: true },
    });
    if (!partner) throw new NotFoundException("Partner organization not found");
    if (!partner.taxIdBlindIndex) {
      throw new BadRequestException("Partner organization has no VÖEN on file");
    }
    if (!this.match.acceptsInbound(partner.settings)) {
      throw new BadRequestException("Partner has not enabled inbound network documents");
    }

    const cp = await this.prisma.counterparty.findFirst({
      where: {
        organizationId,
        taxIdBlindIndex: partner.taxIdBlindIndex,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!cp) {
      throw new BadRequestException(
        "Add a counterparty with the partner VÖEN before ERA network netting",
      );
    }

    const preview = await this.netting.preview(organizationId, cp.id, ledgerType);
    return {
      ...preview,
      partnerOrganizationId: partner.id,
      partnerOrganizationName: partner.name,
      eraNetworkEligible: preview.canNet,
    };
  }

  async executeForPartnerOrganization(
    organizationId: string,
    partnerOrganizationId: string,
    amountRaw: number,
    ledgerType: LedgerType = LedgerType.NAS,
    actingUserRole?: UserRole,
    audit?: { userId?: string; previewSuggestedAmount?: number },
  ) {
    const preview = await this.previewForPartnerOrganization(
      organizationId,
      partnerOrganizationId,
      ledgerType,
    );
    return this.netting.createNetting(
      organizationId,
      preview.counterpartyId,
      amountRaw,
      ledgerType,
      actingUserRole,
      audit,
    );
  }
}
