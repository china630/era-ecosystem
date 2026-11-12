import { Injectable } from "@nestjs/common";
import {
  BillingStatus,
  DeploymentTopology,
  OrgOperatingMode,
  Prisma,
} from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { blindIndexForVoen } from "../common/utils/voen-blind-index";

@Injectable()
export class AdminOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    q?: string;
    page?: number;
    pageSize?: number;
    operatingMode?: string;
    deploymentTopology?: string;
    billingStatus?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
    const q = (opts.q ?? "").trim();

    const where: Prisma.OrganizationWhereInput = { deletedAt: null };
    if (q) {
      const or: Prisma.OrganizationWhereInput[] = [
        { name: { contains: q, mode: "insensitive" } },
      ];
      if (/^[0-9a-f-]{36}$/i.test(q)) {
        or.push({ id: q });
      }
      if (/^[1-9][0-9]{5}$/.test(q)) {
        or.push({ publicOrgNumber: Number(q) });
      }
      if (/^\d{10}$/.test(q)) {
        or.push({
          taxIdBlindIndex: blindIndexForVoen(
            q,
            process.env.PII_BLIND_INDEX_KEY,
          ),
        });
      }
      where.OR = or;
    }

    const mode = (opts.operatingMode ?? "").trim().toUpperCase();
    if (mode && Object.values(OrgOperatingMode).includes(mode as OrgOperatingMode)) {
      where.operatingMode = mode as OrgOperatingMode;
    }
    const topology = (opts.deploymentTopology ?? "").trim().toUpperCase();
    if (
      topology &&
      Object.values(DeploymentTopology).includes(topology as DeploymentTopology)
    ) {
      where.deploymentTopology = topology as DeploymentTopology;
    }
    const billing = (opts.billingStatus ?? "").trim().toUpperCase();
    if (billing && Object.values(BillingStatus).includes(billing as BillingStatus)) {
      where.billingStatus = billing as BillingStatus;
    }

    const [total, rows] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          publicOrgNumber: true,
          operatingMode: true,
          deploymentTopology: true,
          billingStatus: true,
          parentOrgId: true,
          createdAt: true,
          subscription: {
            select: {
              isTrial: true,
              isBlocked: true,
              currentTier: true,
              trialExpiresAt: true,
              expiresAt: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        publicOrgNumber: r.publicOrgNumber,
        operatingMode: r.operatingMode,
        deploymentTopology: r.deploymentTopology,
        billingStatus: r.billingStatus,
        parentOrgId: r.parentOrgId,
        createdAt: r.createdAt.toISOString(),
        isTrial: r.subscription?.isTrial ?? null,
        isBlocked: r.subscription?.isBlocked ?? null,
        currentTier: r.subscription?.currentTier ?? null,
        trialExpiresAt: r.subscription?.trialExpiresAt?.toISOString() ?? null,
        expiresAt: r.subscription?.expiresAt?.toISOString() ?? null,
      })),
    };
  }

  async listOrganizationsForReferenceSource() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, publicOrgNumber: true, settings: true },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  async findOrganizationForReferenceSourcePatch(orgId: string) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, settings: true, deletedAt: true },
    });
  }

  async updateOrganizationReferenceSourceSettings(
    orgId: string,
    settings: Prisma.InputJsonValue,
  ) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { settings },
    });
  }
}
