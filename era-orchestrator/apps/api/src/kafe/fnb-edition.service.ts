import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, isKafeEdition } from "@era365/database";
import { AccessControlService } from "../access/access-control.service";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";

const FNB_KEY = "industry_fnb_pos";

export type FnbEditionState = {
  hasFnb: boolean;
  edition: "kafe" | "fnb" | null;
  canUpgrade: boolean;
};

function settingsRecord(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? { ...(settings as Record<string, unknown>) }
    : {};
}

/**
 * F&B edition on the org: ERA Kafe or full F&B.
 * Upgrade lifts the edition ceiling only — no price line, presets and hotel mode stay on the satellite.
 */
@Injectable()
export class FnbEditionService {
  private readonly log = new Logger(FnbEditionService.name);

  constructor(
    private readonly prisma: ControlPlanePrismaService,
    private readonly access: AccessControlService,
    private readonly bindSync: SatelliteOrgBindSyncService,
  ) {}

  private async loadOrg(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionPlan: true, settings: true, activeModules: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  private stateOf(org: {
    subscriptionPlan: string | null;
    settings: unknown;
    activeModules: string[];
  }): FnbEditionState {
    const hasFnb = org.activeModules.includes(FNB_KEY);
    if (!hasFnb) return { hasFnb, edition: null, canUpgrade: false };
    const kafe = isKafeEdition(org);
    return { hasFnb, edition: kafe ? "kafe" : "fnb", canUpgrade: kafe };
  }

  async state(userId: string, organizationId: string): Promise<FnbEditionState> {
    await this.access.assertOwnerForBilling(userId, organizationId);
    return this.stateOf(await this.loadOrg(organizationId));
  }

  async upgradeToFull(
    userId: string,
    organizationId: string,
  ): Promise<FnbEditionState & { synced: boolean }> {
    await this.access.assertOwnerForBilling(userId, organizationId);
    const org = await this.loadOrg(organizationId);
    const before = this.stateOf(org);
    if (!before.hasFnb) {
      throw new BadRequestException({
        code: "FNB_NOT_CONNECTED",
        message: "F&B satellite is not connected for this organization",
      });
    }
    if (!before.canUpgrade) {
      throw new ConflictException({
        code: "FNB_EDITION_ALREADY_FULL",
        message: "Organization is already on full F&B",
      });
    }

    const settings = settingsRecord(org.settings);
    const oldValues = {
      edition: settings.edition ?? null,
      subscriptionPlan: org.subscriptionPlan,
    };
    settings.edition = "fnb";

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionPlan: "fnb",
          settings: settings as Prisma.InputJsonValue,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: "organization.fnb_edition",
          entityId: organizationId,
          action: "upgrade",
          oldValues: oldValues as Prisma.InputJsonValue,
          newValues: { edition: "fnb", subscriptionPlan: "fnb" },
        },
      });
    });

    let synced = true;
    try {
      await this.bindSync.syncForOrg(organizationId);
    } catch (err) {
      synced = false;
      this.log.warn(
        `F&B edition upgraded for ${organizationId}; runtime-config push failed: ${String(err)}`,
      );
    }
    return { ...this.stateOf(await this.loadOrg(organizationId)), synced };
  }
}
