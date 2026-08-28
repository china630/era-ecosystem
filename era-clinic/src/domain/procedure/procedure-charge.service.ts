import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { useProcedureQuota } from "@/lib/sanatorium-scheduler.service";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";

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
  let overQuota = false;
  if (order.reservationId) {
    const program = await prisma.programInstance.findFirst({
      where: { reservationId: order.reservationId },
    });
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
  }

  const catalog = await prisma.serviceCatalogCache.findFirst({
    where: { code: order.procedureCode },
  });
  let amountNet = Number(order.amountNet);

  if (catalog) {
    if (catalog.packageIncluded) {
      if (!overQuota) {
        amountNet = 0;
      } else {
        const listPrice = Number(catalog.amount);
        amountNet = listPrice > 0 ? listPrice : DEFAULT_OVER_QUOTA_AZN;
      }
    } else if (amountNet <= 0) {
      amountNet = Number(catalog.amount);
    }
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
