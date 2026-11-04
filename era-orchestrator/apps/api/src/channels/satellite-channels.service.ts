import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SatelliteChannelKind,
  SatelliteChannelManagedBy,
} from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  CHANNEL_FINANCE_KEY,
  CHANNEL_HOTEL_BRIDGE_FROM,
  CHANNEL_HOTEL_KEY,
} from "./satellite-channels.constants";

export type ChannelView = {
  id: string;
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: SatelliteChannelKind;
  enabled: boolean;
  managedBy: SatelliteChannelManagedBy;
  fromOrgName?: string | null;
  toOrgName?: string | null;
};

type DesiredEdge = {
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: SatelliteChannelKind;
};

@Injectable()
export class SatelliteChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string): Promise<{
    outbound: ChannelView[];
    inbound: ChannelView[];
  }> {
    const rows = await this.prisma.organizationSatelliteChannel.findMany({
      where: {
        OR: [{ fromOrgId: organizationId }, { toOrgId: organizationId }],
      },
      include: {
        fromOrganization: { select: { name: true } },
        toOrganization: { select: { name: true } },
      },
      orderBy: [{ kind: "asc" }, { fromSatelliteKey: "asc" }],
    });
    const map = (r: (typeof rows)[number]): ChannelView => ({
      id: r.id,
      fromOrgId: r.fromOrgId,
      fromSatelliteKey: r.fromSatelliteKey,
      toOrgId: r.toOrgId,
      toSatelliteKey: r.toSatelliteKey,
      kind: r.kind,
      enabled: r.enabled,
      managedBy: r.managedBy,
      fromOrgName: r.fromOrganization.name,
      toOrgName: r.toOrganization.name,
    });
    return {
      outbound: rows.filter((r) => r.fromOrgId === organizationId).map(map),
      inbound: rows.filter((r) => r.toOrgId === organizationId).map(map),
    };
  }

  async listSnapshotForOrganization(organizationId: string): Promise<
    Array<{
      id: string;
      fromOrgId: string;
      fromSatelliteKey: string;
      toOrgId: string;
      toSatelliteKey: string;
      kind: string;
      enabled: boolean;
      managedBy: string;
    }>
  > {
    const rows = await this.prisma.organizationSatelliteChannel.findMany({
      where: {
        OR: [{ fromOrgId: organizationId }, { toOrgId: organizationId }],
      },
    });
    return rows.map((r) => ({
      id: r.id,
      fromOrgId: r.fromOrgId,
      fromSatelliteKey: r.fromSatelliteKey,
      toOrgId: r.toOrgId,
      toSatelliteKey: r.toSatelliteKey,
      kind: r.kind,
      enabled: r.enabled,
      managedBy: r.managedBy,
    }));
  }

  /**
   * Recompute PLATFORM edges for this org and its department children (if hub).
   */
  async syncPlatformChannels(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        operatingMode: true,
        parentOrgId: true,
        revenueRouting: true,
      },
    });
    if (!org) return;

    const childIds = (
      await this.prisma.organization.findMany({
        where: { parentOrgId: organizationId },
        select: { id: true },
      })
    ).map((c) => c.id);

    const scopeIds = [organizationId, ...childIds];
    for (const id of scopeIds) {
      await this.syncPlatformChannelsForOrg(id);
    }
  }

  private async syncPlatformChannelsForOrg(organizationId: string): Promise<void> {
    const desired = await this.computeDesiredPlatformEdges(organizationId);
    const desiredKeys = new Set(desired.map((e) => this.edgeKey(e)));

    const existing = await this.prisma.organizationSatelliteChannel.findMany({
      where: {
        managedBy: SatelliteChannelManagedBy.PLATFORM,
        OR: [{ fromOrgId: organizationId }, { toOrgId: organizationId }],
      },
    });

    for (const row of existing) {
      const key = this.edgeKey(row);
      if (!desiredKeys.has(key) && row.fromOrgId === organizationId) {
        await this.prisma.organizationSatelliteChannel.delete({
          where: { id: row.id },
        });
      }
    }

    for (const edge of desired) {
      const found = await this.prisma.organizationSatelliteChannel.findUnique({
        where: {
          fromOrgId_fromSatelliteKey_toOrgId_toSatelliteKey_kind: {
            fromOrgId: edge.fromOrgId,
            fromSatelliteKey: edge.fromSatelliteKey,
            toOrgId: edge.toOrgId,
            toSatelliteKey: edge.toSatelliteKey,
            kind: edge.kind,
          },
        },
      });
      if (found?.managedBy === SatelliteChannelManagedBy.ACCEPTOR) {
        continue;
      }
      await this.prisma.organizationSatelliteChannel.upsert({
        where: {
          fromOrgId_fromSatelliteKey_toOrgId_toSatelliteKey_kind: {
            fromOrgId: edge.fromOrgId,
            fromSatelliteKey: edge.fromSatelliteKey,
            toOrgId: edge.toOrgId,
            toSatelliteKey: edge.toSatelliteKey,
            kind: edge.kind,
          },
        },
        create: {
          ...edge,
          enabled: true,
          managedBy: SatelliteChannelManagedBy.PLATFORM,
        },
        update: {
          managedBy: SatelliteChannelManagedBy.PLATFORM,
          enabled: true,
        },
      });
    }
  }

  private async computeDesiredPlatformEdges(
    organizationId: string,
  ): Promise<DesiredEdge[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        operatingMode: true,
        parentOrgId: true,
        revenueRouting: true,
      },
    });
    if (!org) return [];

    const ents = await this.prisma.organizationSatelliteEntitlement.findMany({
      where: { organizationId, suspendedAt: null },
      select: { satelliteKey: true },
    });
    const keys = new Set(ents.map((e) => e.satelliteKey));
    const out: DesiredEdge[] = [];

    const hotelOrgId =
      org.operatingMode === "DEPARTMENT" && org.parentOrgId
        ? org.parentOrgId
        : organizationId;

    const hotelEnt = await this.prisma.organizationSatelliteEntitlement.findUnique(
      {
        where: {
          organizationId_satelliteKey: {
            organizationId: hotelOrgId,
            satelliteKey: CHANNEL_HOTEL_KEY,
          },
        },
        select: { suspendedAt: true },
      },
    );
    const hotelOk = hotelEnt != null && hotelEnt.suspendedAt == null;

    for (const fromKey of CHANNEL_HOTEL_BRIDGE_FROM) {
      if (!keys.has(fromKey) || !hotelOk) continue;
      for (const kind of [
        SatelliteChannelKind.FOLIO_POST,
        SatelliteChannelKind.SETTLEMENT,
      ] as const) {
        out.push({
          fromOrgId: organizationId,
          fromSatelliteKey: fromKey,
          toOrgId: hotelOrgId,
          toSatelliteKey: CHANNEL_HOTEL_KEY,
          kind,
        });
      }
    }

    if (
      org.operatingMode === "DEPARTMENT" &&
      org.parentOrgId &&
      org.revenueRouting === "PARENT"
    ) {
      const parentFinance =
        await this.prisma.organizationSatelliteEntitlement.findUnique({
          where: {
            organizationId_satelliteKey: {
              organizationId: org.parentOrgId,
              satelliteKey: CHANNEL_FINANCE_KEY,
            },
          },
          select: { suspendedAt: true },
        });
      if (parentFinance && parentFinance.suspendedAt == null) {
        for (const fromKey of keys) {
          if (fromKey === CHANNEL_FINANCE_KEY) continue;
          out.push({
            fromOrgId: organizationId,
            fromSatelliteKey: fromKey,
            toOrgId: org.parentOrgId,
            toSatelliteKey: CHANNEL_FINANCE_KEY,
            kind: SatelliteChannelKind.REVENUE_EVENT,
          });
        }
      }
    }

    return out;
  }

  private edgeKey(e: {
    fromOrgId: string;
    fromSatelliteKey: string;
    toOrgId: string;
    toSatelliteKey: string;
    kind: string;
  }): string {
    return `${e.fromOrgId}|${e.fromSatelliteKey}|${e.toOrgId}|${e.toSatelliteKey}|${e.kind}`;
  }

  async adminPatch(
    channelId: string,
    body: { enabled: boolean; managedBy?: "PLATFORM" | "ACCEPTOR" },
  ): Promise<ChannelView> {
    const row = await this.prisma.organizationSatelliteChannel.findUnique({
      where: { id: channelId },
      include: {
        fromOrganization: { select: { name: true } },
        toOrganization: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundException("Channel not found");
    const updated = await this.prisma.organizationSatelliteChannel.update({
      where: { id: channelId },
      data: {
        enabled: body.enabled,
        ...(body.managedBy
          ? {
              managedBy:
                body.managedBy === "PLATFORM"
                  ? SatelliteChannelManagedBy.PLATFORM
                  : SatelliteChannelManagedBy.ACCEPTOR,
            }
          : body.enabled
            ? { managedBy: SatelliteChannelManagedBy.PLATFORM }
            : {}),
      },
      include: {
        fromOrganization: { select: { name: true } },
        toOrganization: { select: { name: true } },
      },
    });
    return {
      id: updated.id,
      fromOrgId: updated.fromOrgId,
      fromSatelliteKey: updated.fromSatelliteKey,
      toOrgId: updated.toOrgId,
      toSatelliteKey: updated.toSatelliteKey,
      kind: updated.kind,
      enabled: updated.enabled,
      managedBy: updated.managedBy,
      fromOrgName: updated.fromOrganization.name,
      toOrgName: updated.toOrganization.name,
    };
  }

  /** Acceptor (active org) disables an incoming channel. */
  async acceptorDisable(
    organizationId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<ChannelView> {
    const row = await this.prisma.organizationSatelliteChannel.findUnique({
      where: { id: channelId },
      include: {
        fromOrganization: { select: { name: true } },
        toOrganization: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundException("Channel not found");
    if (row.toOrgId !== organizationId) {
      throw new ForbiddenException({
        code: "CHANNEL_ACCEPTOR_ONLY",
        message: "Only the accepting organization may toggle this channel",
      });
    }
    if (enabled === true && row.managedBy === SatelliteChannelManagedBy.ACCEPTOR) {
      throw new ForbiddenException({
        code: "CHANNEL_ACCEPTOR_CANNOT_ENABLE",
        message: "Acceptor may disable only; SuperAdmin resets to PLATFORM",
      });
    }
    if (enabled === false) {
      const updated = await this.prisma.organizationSatelliteChannel.update({
        where: { id: channelId },
        data: {
          enabled: false,
          managedBy: SatelliteChannelManagedBy.ACCEPTOR,
        },
        include: {
          fromOrganization: { select: { name: true } },
          toOrganization: { select: { name: true } },
        },
      });
      return {
        id: updated.id,
        fromOrgId: updated.fromOrgId,
        fromSatelliteKey: updated.fromSatelliteKey,
        toOrgId: updated.toOrgId,
        toSatelliteKey: updated.toSatelliteKey,
        kind: updated.kind,
        enabled: updated.enabled,
        managedBy: updated.managedBy,
        fromOrgName: updated.fromOrganization.name,
        toOrgName: updated.toOrganization.name,
      };
    }
    throw new ForbiddenException({
      code: "CHANNEL_ACCEPTOR_ONLY",
      message: "Acceptor disable only",
    });
  }

  async isEnabled(input: {
    fromOrgId: string;
    fromSatelliteKey: string;
    toOrgId: string;
    toSatelliteKey: string;
    kind: SatelliteChannelKind | string;
  }): Promise<boolean> {
    const row = await this.prisma.organizationSatelliteChannel.findUnique({
      where: {
        fromOrgId_fromSatelliteKey_toOrgId_toSatelliteKey_kind: {
          fromOrgId: input.fromOrgId,
          fromSatelliteKey: input.fromSatelliteKey,
          toOrgId: input.toOrgId,
          toSatelliteKey: input.toSatelliteKey,
          kind: input.kind as SatelliteChannelKind,
        },
      },
      select: { enabled: true },
    });
    return row?.enabled === true;
  }
}
