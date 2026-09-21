import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InvoiceStatus,
  Prisma,
  TradeCreditFacilityStatus,
  TradeCreditGrantStatus,
} from "@erafinance/database";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import {
  TRADE_CREDIT_DEFAULT_GRANT_TTL_HOURS,
} from "./trade-credit.constants";
import { TradeCreditPolicyService } from "./trade-credit-policy.service";
import type { TradeCreditPolicyGroupCode } from "./trade-credit-policy.types";
import { TradeCreditRequiredException } from "./trade-credit-required.exception";
import { TradeCreditPhase2Service } from "./trade-credit-phase2.service";

const OPEN_AR_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.LOCKED_BY_SIGNATURE,
];

const GRANT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type TradeCreditFacilityView = {
  counterpartyId: string;
  facilityId: string | null;
  creditLimit: number;
  stopList: boolean;
  status: TradeCreditFacilityStatus | null;
  openAr: number;
  unusedIssuedGrants: number;
  available: number;
};

/** Finance staff view — includes A–D policy fields (never expose to buyer). */
export type TradeCreditStaffFacilityView = TradeCreditFacilityView & {
  policyGroup: TradeCreditPolicyGroupCode | null;
  policyGroupComputed: TradeCreditPolicyGroupCode | null;
  policyGroupManual: TradeCreditPolicyGroupCode | null;
  policyReasons: string[];
  proposedLimit: number | null;
  proposedAt: string | null;
  proposedKind: string | null;
  suggestedLimit: number | null;
  limitBeforeBlock: number | null;
  autoRaiseMuted: boolean;
};

export type IssuedGrantResult = {
  id: string;
  counterpartyId: string;
  amount: number;
  expiresAt: string;
  status: TradeCreditGrantStatus;
  code: string;
  overrideReason: string | null;
};

@Injectable()
export class TradeCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionAccessService,
    private readonly policy: TradeCreditPolicyService,
    private readonly phase2: TradeCreditPhase2Service,
  ) {}

  async assertSku(organizationId: string): Promise<void> {
    const ok = await this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.TRADE_CREDIT_CONTROL,
    );
    if (!ok) {
      throw new TradeCreditRequiredException();
    }
  }

  /** Buyer / residual view — never includes policyGroup (A–D). */
  async getFacilityView(
    organizationId: string,
    counterpartyId: string,
  ): Promise<TradeCreditFacilityView> {
    const base = await this.loadFacilityViewBase(organizationId, counterpartyId);
    return base.view;
  }

  /** Finance staff view with effective A–D and raise/block fields. */
  async getStaffFacilityView(
    organizationId: string,
    counterpartyId: string,
  ): Promise<TradeCreditStaffFacilityView> {
    const { view, facility } = await this.loadFacilityViewBase(
      organizationId,
      counterpartyId,
    );
    const policyGroupComputed = (facility?.policyGroup ??
      null) as TradeCreditPolicyGroupCode | null;
    const policyGroupManual = (facility?.policyGroupManual ??
      null) as TradeCreditPolicyGroupCode | null;
    const policyGroup = facility
      ? this.policy.effectiveGroup(facility)
      : null;
    const reasonsRaw = facility?.policyReasonsJson;
    const policyReasons = Array.isArray(reasonsRaw)
      ? reasonsRaw.filter((r): r is string => typeof r === "string")
      : [];

    return {
      ...view,
      policyGroup,
      policyGroupComputed,
      policyGroupManual,
      policyReasons,
      proposedLimit:
        facility?.proposedLimit != null ? Number(facility.proposedLimit) : null,
      proposedAt: facility?.proposedAt?.toISOString() ?? null,
      proposedKind: facility?.proposedKind ?? null,
      suggestedLimit:
        facility?.suggestedLimit != null
          ? Number(facility.suggestedLimit)
          : null,
      limitBeforeBlock:
        facility?.limitBeforeBlock != null
          ? Number(facility.limitBeforeBlock)
          : null,
      autoRaiseMuted: facility?.autoRaiseMuted ?? false,
    };
  }

  async upsertFacility(
    organizationId: string,
    counterpartyId: string,
    input: {
      creditLimit: number;
      stopList?: boolean;
      status?: TradeCreditFacilityStatus;
    },
  ) {
    await this.assertSku(organizationId);
    await this.assertCounterparty(organizationId, counterpartyId);

    const existing = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
    });
    if (existing && input.stopList === false) {
      const effective = this.policy.effectiveGroup(existing);
      if (effective === "D") {
        throw new BadRequestException(
          "Group D: use restore-after-block (or clear D pin) before clearing stop-list",
        );
      }
    }

    const row = await this.prisma.tradeCreditFacility.upsert({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
      create: {
        organizationId,
        counterpartyId,
        creditLimit: new Prisma.Decimal(input.creditLimit),
        stopList: input.stopList ?? false,
        status: input.status ?? TradeCreditFacilityStatus.ACTIVE,
      },
      update: {
        creditLimit: new Prisma.Decimal(input.creditLimit),
        ...(input.stopList !== undefined ? { stopList: input.stopList } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    return this.getStaffFacilityView(organizationId, counterpartyId).then(
      (view) => ({
        ...view,
        facilityId: row.id,
      }),
    );
  }

  async issueGrant(params: {
    organizationId: string;
    counterpartyId: string;
    amount: number;
    override?: boolean;
    reason?: string;
    issuedByUserId?: string | null;
    issuedByBuyer?: boolean;
    ttlHours?: number;
  }): Promise<IssuedGrantResult> {
    await this.assertSku(params.organizationId);
    await this.assertCounterparty(params.organizationId, params.counterpartyId);

    if (params.amount <= 0) {
      throw new BadRequestException("Grant amount must be positive");
    }

    const view = await this.getFacilityView(
      params.organizationId,
      params.counterpartyId,
    );
    if (!view.facilityId) {
      throw new BadRequestException("Trade credit facility is not configured");
    }

    const facility = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: {
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
        },
      },
    });
    if (!facility) {
      throw new BadRequestException("Trade credit facility is not configured");
    }

    const override = params.override === true;
    const orgPolicy = await this.policy.getOrgPolicyDefaults(
      params.organizationId,
    );
    const effective = this.policy.effectiveGroup(facility);
    const features = await this.policy.buildFeatures(
      params.organizationId,
      params.counterpartyId,
      Number(facility.creditLimit),
      view.openAr,
    );

    if (effective === "D" && !override) {
      throw new BadRequestException(
        "Group D: prepaid only — trade credit grants are blocked",
      );
    }

    if (effective === "B" && !override) {
      if (features.maxDpd > 0) {
        throw new BadRequestException(
          "Group B: grant blocked while overdue (maxDpd > 0); clear AR or use finance override",
        );
      }
    }

    if (
      effective === "C" &&
      orgPolicy.groupCRequireConfirm &&
      !override
    ) {
      throw new BadRequestException(
        "Group C: finance confirm/override required to issue grant",
      );
    }

    if (params.amount > view.available) {
      if (!override) {
        throw new BadRequestException(
          `Grant amount ${params.amount} exceeds available residual ${view.available}`,
        );
      }
      if (!params.reason || params.reason.trim().length < 3) {
        throw new BadRequestException(
          "Override requires a reason (min 3 characters)",
        );
      }
    }

    let defaultTtl = TRADE_CREDIT_DEFAULT_GRANT_TTL_HOURS;
    if (effective === "A") defaultTtl = orgPolicy.grantTtlHoursA;
    else if (effective === "B") defaultTtl = orgPolicy.grantTtlHoursB;
    else if (effective === "C") defaultTtl = orgPolicy.grantTtlHoursC;

    // Buyers never pass ttlHours. Staff may shorten; may not exceed policy TTL for C
    // without override (prevents bypassing group-C short TTL).
    let ttlHours = defaultTtl;
    if (
      params.ttlHours &&
      params.ttlHours > 0 &&
      !params.issuedByBuyer
    ) {
      if (effective === "C" && params.ttlHours > defaultTtl && !override) {
        throw new BadRequestException(
          `Group C: grant TTL cannot exceed ${defaultTtl}h without finance override`,
        );
      }
      ttlHours = params.ttlHours;
    }
    if (
      !override &&
      features.partialPayRatio >= orgPolicy.partialPayThreshold
    ) {
      ttlHours = Math.min(ttlHours, orgPolicy.grantTtlHoursC);
    }
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const code = this.generateGrantCode();
    const codeHash = hashGrantCode(code);

    const grant = await this.prisma.tradeCreditGrant.create({
      data: {
        organizationId: params.organizationId,
        counterpartyId: params.counterpartyId,
        facilityId: view.facilityId,
        amount: new Prisma.Decimal(params.amount),
        codeHash,
        expiresAt,
        status: TradeCreditGrantStatus.ISSUED,
        issuedByUserId: params.issuedByUserId ?? null,
        issuedByBuyer: params.issuedByBuyer ?? false,
        overrideReason: override ? params.reason!.trim() : null,
      },
    });

    return {
      id: grant.id,
      counterpartyId: grant.counterpartyId,
      amount: Number(grant.amount),
      expiresAt: grant.expiresAt.toISOString(),
      status: grant.status,
      code,
      overrideReason: grant.overrideReason,
    };
  }

  async voidGrant(organizationId: string, grantId: string) {
    await this.assertSku(organizationId);
    const grant = await this.prisma.tradeCreditGrant.findFirst({
      where: { id: grantId, organizationId },
    });
    if (!grant) {
      throw new NotFoundException("Grant not found");
    }
    if (grant.status !== TradeCreditGrantStatus.ISSUED) {
      throw new ConflictException(
        `Grant cannot be voided in status ${grant.status}`,
      );
    }
    const updated = await this.prisma.tradeCreditGrant.update({
      where: { id: grantId },
      data: { status: TradeCreditGrantStatus.VOID },
    });
    this.policy.scheduleReclassify(organizationId, grant.counterpartyId);
    return this.serializeGrant(updated);
  }

  async listGrants(
    organizationId: string,
    filter?: { counterpartyId?: string; status?: TradeCreditGrantStatus },
  ) {
    await this.assertSku(organizationId);
    await this.expireStaleGrants(organizationId, filter?.counterpartyId);

    const rows = await this.prisma.tradeCreditGrant.findMany({
      where: {
        organizationId,
        ...(filter?.counterpartyId
          ? { counterpartyId: filter.counterpartyId }
          : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => this.serializeGrant(r));
  }

  /**
   * Staff facilities list (optional effective policyGroup filter).
   * Never returned to buyer APIs.
   */
  async listFacilities(
    organizationId: string,
    filter?: { policyGroup?: TradeCreditPolicyGroupCode },
  ): Promise<
    Array<{
      id: string;
      counterpartyId: string;
      creditLimit: number;
      stopList: boolean;
      policyGroup: TradeCreditPolicyGroupCode | null;
      proposedLimit: number | null;
      proposedKind: string | null;
      suggestedLimit: number | null;
      limitBeforeBlock: number | null;
    }>
  > {
    await this.assertSku(organizationId);

    const rows = await this.prisma.tradeCreditFacility.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        id: true,
        counterpartyId: true,
        creditLimit: true,
        stopList: true,
        policyGroup: true,
        policyGroupManual: true,
        proposedLimit: true,
        proposedKind: true,
        suggestedLimit: true,
        limitBeforeBlock: true,
      },
    });

    const mapped = rows.map((r) => {
      const policyGroup = this.policy.effectiveGroup(r);
      return {
        id: r.id,
        counterpartyId: r.counterpartyId,
        creditLimit: Number(r.creditLimit),
        stopList: r.stopList,
        policyGroup,
        proposedLimit:
          r.proposedLimit != null ? Number(r.proposedLimit) : null,
        proposedKind: r.proposedKind ?? null,
        suggestedLimit:
          r.suggestedLimit != null ? Number(r.suggestedLimit) : null,
        limitBeforeBlock:
          r.limitBeforeBlock != null ? Number(r.limitBeforeBlock) : null,
      };
    });

    if (!filter?.policyGroup) return mapped;
    return mapped.filter((r) => r.policyGroup === filter.policyGroup);
  }

  /**
   * Satellite consume (Wholesale shipment). Atomic; 409 on mismatch / expiry / over-amount.
   */
  async consumeGrant(params: {
    organizationId: string;
    counterpartyId: string;
    code: string;
    amount: number;
    sourceEntityType: string;
    sourceEntityId: string;
  }) {
    await this.assertSku(params.organizationId);

    if (params.amount <= 0) {
      throw new BadRequestException("Consume amount must be positive");
    }

    const codeHash = hashGrantCode(params.code.trim());

    return this.prisma.$transaction(async (tx) => {
      await tx.tradeCreditGrant.updateMany({
        where: {
          organizationId: params.organizationId,
          status: TradeCreditGrantStatus.ISSUED,
          expiresAt: { lte: new Date() },
        },
        data: { status: TradeCreditGrantStatus.EXPIRED },
      });

      const grant = await tx.tradeCreditGrant.findFirst({
        where: {
          organizationId: params.organizationId,
          codeHash,
        },
      });

      if (!grant) {
        throw new ConflictException("Grant code not found");
      }
      if (grant.counterpartyId !== params.counterpartyId) {
        throw new ConflictException("Grant counterparty mismatch");
      }
      if (grant.status === TradeCreditGrantStatus.EXPIRED) {
        throw new ConflictException("Grant has expired");
      }
      if (grant.status !== TradeCreditGrantStatus.ISSUED) {
        throw new ConflictException(`Grant is ${grant.status}`);
      }
      if (grant.expiresAt.getTime() <= Date.now()) {
        await tx.tradeCreditGrant.update({
          where: { id: grant.id },
          data: { status: TradeCreditGrantStatus.EXPIRED },
        });
        throw new ConflictException("Grant has expired");
      }

      const facility = await tx.tradeCreditFacility.findFirst({
        where: {
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
        },
      });
      if (
        !facility ||
        facility.stopList ||
        facility.status === TradeCreditFacilityStatus.DISABLED
      ) {
        throw new ConflictException(
          "Trade credit facility is blocked (stop-list or disabled)",
        );
      }
      const effective = this.policy.effectiveGroup(facility);
      if (effective === "D") {
        throw new ConflictException(
          "Group D: prepaid only — grant consume refused",
        );
      }

      const grantAmount = Number(grant.amount);
      if (params.amount > grantAmount + 1e-9) {
        throw new ConflictException(
          `Consume amount ${params.amount} exceeds grant amount ${grantAmount}`,
        );
      }

      const updated = await tx.tradeCreditGrant.update({
        where: { id: grant.id },
        data: {
          status: TradeCreditGrantStatus.CONSUMED,
          consumedAt: new Date(),
          consumedRefType: params.sourceEntityType,
          consumedRefId: params.sourceEntityId,
        },
      });

      return this.serializeGrant(updated);
    }).then((serialized) => {
      this.policy.scheduleReclassify(
        params.organizationId,
        params.counterpartyId,
      );
      return serialized;
    });
  }

  async computeOpenAr(
    organizationId: string,
    counterpartyId: string,
  ): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        counterpartyId,
        status: { in: OPEN_AR_STATUSES },
        deletedAt: null,
      },
      select: { totalAmount: true, paidAmount: true },
    });
    let open = 0;
    for (const inv of invoices) {
      const rem = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (rem > 0) open += rem;
    }
    return Math.round(open * 10000) / 10000;
  }

  /** Open AR invoice rows for buyer payment schedule (no A–D / risk fields). */
  async listOpenArInvoices(organizationId: string, counterpartyId: string) {
    await this.assertSku(organizationId);
    await this.assertCounterparty(organizationId, counterpartyId);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        counterpartyId,
        status: { in: OPEN_AR_STATUSES },
        deletedAt: null,
      },
      select: {
        id: true,
        number: true,
        status: true,
        dueDate: true,
        currency: true,
        totalAmount: true,
        paidAmount: true,
      },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      take: 200,
    });

    return invoices
      .map((inv) => {
        const total = Number(inv.totalAmount);
        const paid = Number(inv.paidAmount);
        const remaining = Math.round((total - paid) * 10000) / 10000;
        return {
          id: inv.id,
          number: inv.number,
          status: inv.status,
          dueDate: inv.dueDate.toISOString().slice(0, 10),
          currency: inv.currency,
          totalAmount: total,
          paidAmount: paid,
          remaining,
        };
      })
      .filter((row) => row.remaining > 0);
  }

  async computeUnusedIssuedGrants(
    organizationId: string,
    counterpartyId: string,
  ): Promise<number> {
    const rows = await this.prisma.tradeCreditGrant.findMany({
      where: {
        organizationId,
        counterpartyId,
        status: TradeCreditGrantStatus.ISSUED,
        expiresAt: { gt: new Date() },
      },
      select: { amount: true },
    });
    return Math.round(
      rows.reduce((s, r) => s + Number(r.amount), 0) * 10000,
    ) / 10000;
  }

  private async expireStaleGrants(
    organizationId: string,
    counterpartyId?: string,
  ): Promise<void> {
    const stale = await this.prisma.tradeCreditGrant.findMany({
      where: {
        organizationId,
        ...(counterpartyId ? { counterpartyId } : {}),
        status: TradeCreditGrantStatus.ISSUED,
        expiresAt: { lte: new Date() },
      },
      select: { id: true, amount: true, counterpartyId: true },
      take: 100,
    });
    if (stale.length === 0) return;
    await this.prisma.tradeCreditGrant.updateMany({
      where: { id: { in: stale.map((g) => g.id) } },
      data: { status: TradeCreditGrantStatus.EXPIRED },
    });
    for (const g of stale) {
      void this.phase2.maybeNotifyGrantExpired({
        organizationId,
        counterpartyId: g.counterpartyId,
        grantId: g.id,
        amount: Number(g.amount),
      });
    }
  }

  private async loadFacilityViewBase(
    organizationId: string,
    counterpartyId: string,
  ): Promise<{
    view: TradeCreditFacilityView;
    facility: Awaited<
      ReturnType<PrismaService["tradeCreditFacility"]["findUnique"]>
    >;
  }> {
    await this.assertSku(organizationId);
    await this.assertCounterparty(organizationId, counterpartyId);
    await this.expireStaleGrants(organizationId, counterpartyId);

    const facility = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
    });

    const openAr = await this.computeOpenAr(organizationId, counterpartyId);
    const unusedIssuedGrants = await this.computeUnusedIssuedGrants(
      organizationId,
      counterpartyId,
    );

    const creditLimit = facility ? Number(facility.creditLimit) : 0;
    const stopList = facility?.stopList ?? false;
    const status = facility?.status ?? null;
    const blocked =
      !facility ||
      stopList ||
      status === TradeCreditFacilityStatus.DISABLED ||
      creditLimit <= 0;
    const available = blocked
      ? 0
      : Math.max(0, creditLimit - openAr - unusedIssuedGrants);

    return {
      facility,
      view: {
        counterpartyId,
        facilityId: facility?.id ?? null,
        creditLimit,
        stopList,
        status,
        openAr,
        unusedIssuedGrants,
        available,
      },
    };
  }

  private async assertCounterparty(
    organizationId: string,
    counterpartyId: string,
  ): Promise<void> {
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!cp) {
      throw new NotFoundException("Counterparty not found");
    }
  }

  private generateGrantCode(length = 12): string {
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += GRANT_CODE_ALPHABET[bytes[i]! % GRANT_CODE_ALPHABET.length];
    }
    return out;
  }

  private serializeGrant(grant: {
    id: string;
    counterpartyId: string;
    facilityId: string;
    amount: Prisma.Decimal | number;
    expiresAt: Date;
    status: TradeCreditGrantStatus;
    issuedByUserId: string | null;
    issuedByBuyer: boolean;
    consumedAt: Date | null;
    consumedRefType: string | null;
    consumedRefId: string | null;
    overrideReason: string | null;
    createdAt: Date;
  }) {
    return {
      id: grant.id,
      counterpartyId: grant.counterpartyId,
      facilityId: grant.facilityId,
      amount: Number(grant.amount),
      expiresAt: grant.expiresAt.toISOString(),
      status: grant.status,
      issuedByUserId: grant.issuedByUserId,
      issuedByBuyer: grant.issuedByBuyer,
      consumedAt: grant.consumedAt?.toISOString() ?? null,
      consumedRefType: grant.consumedRefType,
      consumedRefId: grant.consumedRefId,
      overrideReason: grant.overrideReason,
      createdAt: grant.createdAt.toISOString(),
    };
  }
}

export function hashGrantCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}
