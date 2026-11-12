import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  brandFromRow,
  parseGuestAppPatch,
  type GuestAppBrand,
  type GuestAppPatch,
} from "./guest-app-brand";

@Injectable()
export class GuestAppService {
  constructor(private readonly prisma: PrismaService) {}

  async getBrand(organizationId: string): Promise<GuestAppBrand> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, guestApp: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return brandFromRow(org.id, org.guestApp);
  }

  async patchBrand(
    organizationId: string,
    actorUserId: string,
    raw: unknown,
  ): Promise<GuestAppBrand> {
    let dto: GuestAppPatch;
    try {
      dto = parseGuestAppPatch(raw);
    } catch (err) {
      const code = err instanceof Error ? err.message : "BODY";
      throw new BadRequestException({ code, message: code });
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const stored = {
      ...dto,
      catalogJson: dto.catalogJson as Prisma.InputJsonValue,
      offersJson: dto.offersJson as Prisma.InputJsonValue,
      enabledOrderKinds: dto.enabledOrderKinds as Prisma.InputJsonValue,
    };
    await this.prisma.organizationGuestApp.upsert({
      where: { organizationId },
      create: { organizationId, ...stored },
      update: stored,
    });
    await this.prisma.auditLog
      .create({
        data: {
          organizationId,
          userId: actorUserId,
          action: "GUEST_APP_BRAND_UPDATE",
          entityType: "ORGANIZATION_GUEST_APP",
          entityId: organizationId,
          newValues: stored as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);
    return this.getBrand(organizationId);
  }
}
