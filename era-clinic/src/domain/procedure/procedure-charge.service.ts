import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { useProcedureQuota } from "@/lib/sanatorium-scheduler.service";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import { isSameDayFourthOrLater } from "@/lib/sanatorium-day1";

const DEFAULT_OVER_QUOTA_AZN = 25;

export type ProcedureChargeContext = {
  overQuota: boolean;
  amountNet: number;
  shouldChargeFolio: boolean;
};

/**
 * Resolve quota burn + list/package pricing for a procedure order.
 * Shared by COMPLETED and NO_SHOW (client-fault still burns quota / may charge).
 * Pass `{ burnQuota: false }` for Issue-ticket / nurse gate so listing a ticket does not consume quota.
 */
export async function resolveProcedureCharge(
  order: {
    id: string;
    procedureCode: string;
    procedureName: string;
    reservationId: string | null;
    patientOrigin: string;
    amountNet: unknown;
  },
  opts?: { burnQuota?: boolean },
): Promise<ProcedureChargeContext> {
  const burnQuota = opts?.burnQuota !== false;
  // Wave E / Wave B: prefer patientRef-scoped program instance over reservation-only findFirst
  let overQuota = false;
  const orderFull = await prisma.procedureOrder.findUnique({
    where: { id: order.id },
    select: { patientRefId: true },
  });
  const program = orderFull?.patientRefId
    ? await prisma.programInstance.findFirst({
        where: {
          episode: { patientRefId: orderFull.patientRefId, status: "OPEN" },
        },
      })
    : order.reservationId
      ? await prisma.programInstance.findFirst({
          where: { reservationId: order.reservationId },
        })
      : null;
  if (program) {
    if (burnQuota) {
      const quota = await useProcedureQuota({
        instanceId: program.id,
        procedureCode: order.procedureCode,
      });
      overQuota = quota.overQuota;
    } else {
      const line = await prisma.programProcedureBalance.findUnique({
        where: {
          instanceId_procedureCode: {
            instanceId: program.id,
            procedureCode: order.procedureCode,
          },
        },
      });
      overQuota = !!line && line.quotaUsed >= line.quotaTotal;
    }
  }

  const catalog = await prisma.serviceCatalogCache.findFirst({
    where: { code: order.procedureCode },
  });
  let amountNet = Number(order.amountNet);

  // Wave E: free = remaining quota on *this* patient's program instance
  const hasProgramBalance =
    !!program &&
    !!(await prisma.programProcedureBalance.findFirst({
      where: {
        procedureCode: order.procedureCode,
        instanceId: program.id,
      },
    }));

  if (hasProgramBalance && !overQuota) {
    amountNet = 0;
  } else if (catalog) {
    if (catalog.packageIncluded) {
      if (!overQuota) {
        amountNet = 0;
      } else {
        const listPrice = Number(catalog.amount);
        amountNet = listPrice > 0 ? listPrice : DEFAULT_OVER_QUOTA_AZN;
      }
    } else if (amountNet <= 0 || overQuota) {
      const listPrice = Number(catalog.amount);
      amountNet = listPrice > 0 ? listPrice : amountNet;
    }
  }

  // Wave C: PDF >3 same calendar day (Asia/Baku) → 4th+ paid even if quota remains; do not burn knot further.
  if (hasProgramBalance && amountNet === 0 && order.patientOrigin === "IN_HOUSE") {
    const { bakuDayBounds, todayBakuYmd } = await import("@/domain/ops/day-summary.service");
    const { start, end } = bakuDayBounds(todayBakuYmd());
    const sameDayCount = await prisma.procedureOrder.count({
      where: {
        patientRefId: orderFull?.patientRefId,
        status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED"] },
        scheduledAt: { gte: start, lt: end },
        id: { not: order.id },
      },
    });
    if (isSameDayFourthOrLater(sameDayCount)) {
      const listPrice = catalog ? Number(catalog.amount) : 0;
      amountNet = listPrice > 0 ? listPrice : DEFAULT_OVER_QUOTA_AZN;
      // Refund the knot burn on *this* patient's instance
      if (burnQuota && program) {
        const line = await prisma.programProcedureBalance.findUnique({
          where: {
            instanceId_procedureCode: {
              instanceId: program.id,
              procedureCode: order.procedureCode,
            },
          },
        });
        if (line && line.quotaUsed > 0) {
          await prisma.programProcedureBalance.update({
            where: { id: line.id },
            data: { quotaUsed: { decrement: 1 } },
          });
        }
      }
    }
  }

  // Walk-in without program balance → always list price when amount unset
  if (order.patientOrigin === "WALK_IN" && !hasProgramBalance && amountNet <= 0) {
    const listPrice = catalog ? Number(catalog.amount) : 0;
    amountNet = listPrice > 0 ? listPrice : DEFAULT_OVER_QUOTA_AZN;
  }

  if (overQuota && amountNet <= 0) {
    const listPrice = catalog ? Number(catalog.amount) : 0;
    amountNet = listPrice > 0 ? listPrice : DEFAULT_OVER_QUOTA_AZN;
  }

  const settings = await getSchedulingSettings();
  const billingTarget = await resolveBillingTarget(order.patientOrigin as "WALK_IN" | "IN_HOUSE");
  const shouldChargeFolio =
    billingTarget === "HOTEL_FOLIO" &&
    !!order.reservationId &&
    amountNet > 0 &&
    (!overQuota || settings.procedureOverQuotaPolicy === "CHARGE_FOLIO");

  return { overQuota, amountNet, shouldChargeFolio };
}

export async function postProcedureFolioCharge(input: {
  reservationId: string;
  amount: number;
  description: string;
  externalTicketId: string;
}): Promise<void> {
  await postHotelRoomCharge({
    reservationId: input.reservationId,
    amount: input.amount,
    description: input.description,
    externalTicketId: input.externalTicketId,
  });
}

/** Persist charge visibility for cashier (folio / local / blocked / warn). */
export async function logProcedureCharge(input: {
  procedureOrderId: string;
  patientRefId: string;
  reservationId?: string | null;
  procedureCode: string;
  procedureName: string;
  amountNet: number;
  overQuota: boolean;
  channel: "HOTEL_FOLIO" | "LOCAL" | "BLOCKED" | "WARN_ONLY";
  externalTicketId?: string | null;
}): Promise<void> {
  if (input.amountNet <= 0 && !input.overQuota) return;
  await prisma.procedureChargeLog.create({
    data: {
      procedureOrderId: input.procedureOrderId,
      patientRefId: input.patientRefId,
      reservationId: input.reservationId ?? null,
      procedureCode: input.procedureCode,
      procedureName: input.procedureName,
      amountNet: input.amountNet,
      overQuota: input.overQuota,
      channel: input.channel,
      externalTicketId: input.externalTicketId ?? null,
    },
  });
}

export { DEFAULT_OVER_QUOTA_AZN };
