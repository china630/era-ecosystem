import { Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { blindIndexForVoen } from "../common/utils/voen-blind-index";

@Injectable()
export class AdminOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { q?: string; page?: number; pageSize?: number }) {
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
}
