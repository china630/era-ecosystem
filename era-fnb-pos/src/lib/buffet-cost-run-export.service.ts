import { bakuDayBounds } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getEffectiveBuffetCostForOutlet } from "@/lib/buffet-cost-settings.service";
import { buildCostRunAttributionSlices } from "@/lib/staff-buffet-overlap";
import {
  attributePosLinesForCostRun,
  type PosLineForCostRun,
  type UnitCogsLookup,
} from "@/lib/buffet-comp-attribution";

/**
 * Load CLOSED ticket lines for outlet × Asia/Baku civil range (inclusive).
 */
export async function loadOutletPosLinesForCostRun(args: {
  outletId: string;
  fromYmd: string;
  toYmd: string;
  organizationId?: string;
}): Promise<PosLineForCostRun[]> {
  const organizationId = args.organizationId ?? requestOrganizationId();
  if (args.fromYmd > args.toYmd) {
    throw Object.assign(new Error("INVALID_DATE_RANGE"), { code: "INVALID_DATE_RANGE" });
  }
  const from = bakuDayBounds(args.fromYmd);
  const to = bakuDayBounds(args.toYmd);
  // bakuDayBounds.end is exclusive next midnight — use lt so the `to` day is inclusive.
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      outletId: args.outletId,
      status: "CLOSED",
      closedAt: { gte: from.start, lt: to.end },
    },
    select: {
      id: true,
      paymentMethod: true,
      lines: {
        select: {
          id: true,
          qty: true,
          unitPriceAzn: true,
          kitchenStatus: true,
          description: true,
          menuItem: { select: { recipeSku: true, plu: true } },
        },
      },
    },
  });

  const out: PosLineForCostRun[] = [];
  for (const ticket of tickets) {
    for (const line of ticket.lines) {
      out.push({
        lineId: line.id,
        ticketId: ticket.id,
        qty: line.qty,
        unitPriceAzn: Number(line.unitPriceAzn),
        kitchenStatus: line.kitchenStatus,
        paymentMethod: ticket.paymentMethod,
        description: line.description,
        recipeSku: line.menuItem?.recipeSku ?? null,
        plu: line.menuItem?.plu ?? null,
      });
    }
  }
  return out;
}

export type BuffetCostRunExportArgs = {
  outletId: string;
  fromYmd: string;
  toYmd: string;
  foodUsageAzn: number;
  staffGrossAzn: number;
  unitCogsBySku?: Record<string, number>;
  defaultUnitCogsAzn?: number;
};

/**
 * Full F&B cost-run export slice for Finance (Waves 3–4).
 * POS sale + named COMP bucket + staff overlap netting.
 */
export async function exportBuffetCostRunSlice(args: BuffetCostRunExportArgs) {
  const organizationId = requestOrganizationId();
  const outlet = await prisma.outlet.findFirst({
    where: { id: args.outletId, organizationId },
    select: { id: true, code: true, name: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }

  const lookup: UnitCogsLookup = {
    unitCogsBySku: args.unitCogsBySku,
    defaultUnitCogsAzn: args.defaultUnitCogsAzn,
  };
  const rawLines = await loadOutletPosLinesForCostRun({
    outletId: args.outletId,
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    organizationId,
  });
  const pos = attributePosLinesForCostRun(rawLines, lookup);

  const effective = await getEffectiveBuffetCostForOutlet(args.outletId, organizationId);
  const slices = buildCostRunAttributionSlices({
    foodUsage: args.foodUsageAzn,
    posAttributed: pos.posAttributedAzn,
    staffGross: args.staffGrossAzn,
    mode: effective.staffBuffetOverlap,
    overlapPct: effective.overlapPct,
  });

  const activePlan = await prisma.buffetStaffMealPlan.findFirst({
    where: { organizationId, outletId: args.outletId, active: true },
    select: { id: true, name: true },
  });

  return {
    outletId: outlet.id,
    outletCode: outlet.code,
    outletName: outlet.name,
    period: { from: args.fromYmd, to: args.toYmd },
    /** Effective outlet model — OFF = à-la-carte; COMP tags still returned. */
    buffetCostModel: effective.buffetCostModel,
    staffPlan: activePlan
      ? { id: activePlan.id, name: activePlan.name }
      : null,
    overlapSettings: {
      staffBuffetOverlap: effective.staffBuffetOverlap,
      overlapPct: effective.overlapPct,
    },
    pos: {
      saleAttributedAzn: pos.saleAttributedAzn,
      /** Named COMP / zero-price COGS bucket (Wave 4). */
      compAttributedAzn: pos.compAttributedAzn,
      posAttributedAzn: pos.posAttributedAzn,
      saleLineCount: pos.saleLineCount,
      compLineCount: pos.compLineCount,
      saleQty: pos.saleQty,
      compQty: pos.compQty,
      warnings: pos.warnings,
      /** Cap sample for payload size; full counts above. */
      sampleLines: pos.lines.slice(0, 100),
    },
    ...slices,
  };
}
