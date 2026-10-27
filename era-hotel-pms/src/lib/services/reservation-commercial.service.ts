import type { CommissionBasis, RoomPayer } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import {
  ensureOpenFolio,
  isRoomAndTaxRevenueCode,
} from '@/lib/services/booking-folio.service';
import { transferFolioCharge } from '@/lib/services/folio-transfer.service';
import { revenueRoleIn, STAY_NIGHT_ROLES } from '@/lib/revenue-code-match';

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function payerToFolioType(payer: RoomPayer): 'GUEST' | 'AGENCY' | 'COMPANY' {
  if (payer === 'AGENCY') return 'AGENCY';
  if (payer === 'COMPANY') return 'COMPANY';
  return 'GUEST';
}

/** Close the open commercial period and open a new one from today (Asia/Baku). */
export async function applyCommercialAmend(input: {
  reservationId: string;
  roomPayer: RoomPayer;
  commissionBasis: CommissionBasis;
  agencyId?: string | null;
  companyId?: string | null;
  salesContractId?: string | null;
  mode: 'NEXT_NIGHTS' | 'MOVE_POSTED';
  reason?: string | null;
  actorUserId?: string | null;
  note: string;
}) {
  const stay = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      id: true,
      checkInDate: true,
      agencyId: true,
      companyId: true,
      salesContractId: true,
      roomPayer: true,
      commissionBasis: true,
    },
  });
  if (!stay) throw new Error('Reservation not found');

  const today = todayBakuYmd();
  const yesterday = addDaysYmd(today, -1);
  const orgId = requestOrganizationId();

  let commissionPercent: number | null = null;
  if (input.salesContractId) {
    const contract = await prisma.salesContract.findUnique({
      where: { id: input.salesContractId },
      select: { commissionPercent: true },
    });
    commissionPercent =
      contract?.commissionPercent != null ? decimalToNumber(contract.commissionPercent) : null;
  } else if (input.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: input.agencyId },
      select: { commissionPercent: true },
    });
    commissionPercent =
      agency?.commissionPercent != null ? decimalToNumber(agency.commissionPercent) : null;
  }

  await prisma.$transaction(async (tx) => {
    const open = await tx.reservationCommercialPeriod.findFirst({
      where: { reservationId: input.reservationId, toDate: null },
      orderBy: { fromDate: 'desc' },
    });
    if (open) {
      const fromKey = hotelDateKey(open.fromDate);
      await tx.reservationCommercialPeriod.update({
        where: { id: open.id },
        data: { toDate: fromKey >= today ? open.fromDate : new Date(`${yesterday}T00:00:00.000Z`) },
      });
    } else {
      // Seed a closed period for the prior values so commission can split.
      await tx.reservationCommercialPeriod.create({
        data: {
          organizationId: orgId,
          reservationId: input.reservationId,
          fromDate: stay.checkInDate,
          toDate: new Date(`${yesterday}T00:00:00.000Z`),
          roomPayer: stay.roomPayer,
          commissionBasis: stay.commissionBasis,
          agencyId: stay.agencyId,
          companyId: stay.companyId,
          salesContractId: stay.salesContractId,
        },
      });
    }

    await tx.reservationCommercialPeriod.create({
      data: {
        organizationId: orgId,
        reservationId: input.reservationId,
        fromDate: new Date(`${today}T00:00:00.000Z`),
        toDate: null,
        roomPayer: input.roomPayer,
        commissionBasis: input.commissionBasis,
        agencyId: input.agencyId ?? null,
        companyId: input.companyId ?? null,
        salesContractId: input.salesContractId ?? null,
        commissionPercent: commissionPercent != null ? toDecimal(commissionPercent) : null,
        movePostedNights: input.mode === 'MOVE_POSTED',
        reason: input.reason?.trim() || null,
        note: input.note,
        createdByUserId: input.actorUserId ?? null,
      },
    });

    await tx.reservation.update({
      where: { id: input.reservationId },
      data: {
        roomPayer: input.roomPayer,
        commissionBasis: input.commissionBasis,
      },
    });

    // Folio note (BILLING) — upsert by note type when present.
    await tx.reservationNote.upsert({
      where: {
        reservationId_noteType: {
          reservationId: input.reservationId,
          noteType: 'BILLING',
        },
      },
      create: {
        organizationId: orgId,
        reservationId: input.reservationId,
        noteType: 'BILLING',
        text: input.note,
      },
      update: {
        text: input.note,
      },
    });
  });

  if (input.mode === 'MOVE_POSTED') {
    const reason = input.reason?.trim();
    if (!reason) throw new Error('COMMERCIAL_MOVE_REASON_REQUIRED');
    const targetType = payerToFolioType(input.roomPayer);
    if (targetType !== 'GUEST') {
      await ensureOpenFolio(input.reservationId, targetType);
    }
    const charges = await prisma.folioCharge.findMany({
      where: {
        folio: { reservationId: input.reservationId, status: 'OPEN' },
      },
      include: {
        folio: true,
        revenueCode: { include: { ratePlansRoom: { select: { id: true }, take: 1 } } },
      },
    });
    for (const charge of charges) {
      const roomTax =
        charge.revenueCode &&
        (isRoomAndTaxRevenueCode(charge.revenueCode) ||
          revenueRoleIn(charge.revenueCode, [...STAY_NIGHT_ROLES, 'CITY_TAX']));
      if (!roomTax) continue;
      if (charge.folio.type === targetType) continue;
      await transferFolioCharge({
        chargeId: charge.id,
        note: reason,
        targetFolioType: targetType,
        targetReservationId: input.reservationId,
        actorUserId: input.actorUserId ?? undefined,
      });
    }
  }
}

export async function assertPartyClearable(input: {
  reservationId: string;
  clearAgency?: boolean;
  clearCompany?: boolean;
}) {
  if (input.clearCompany) {
    const companyFolio = await prisma.folio.findFirst({
      where: { reservationId: input.reservationId, type: 'COMPANY' },
      include: { charges: { select: { id: true } }, payments: { select: { id: true, voidedAt: true } } },
    });
    const companyLines =
      (companyFolio?.charges.length ?? 0) > 0 ||
      (companyFolio?.payments.some((row) => !row.voidedAt) ?? false);
    if (companyLines) throw new Error('COMPANY_FOLIO_HAS_LINES');
  }
  if (input.clearAgency) {
    const agencyFolio = await prisma.folio.findFirst({
      where: { reservationId: input.reservationId, type: 'AGENCY' },
      include: { charges: { select: { id: true } }, payments: { select: { id: true, voidedAt: true } } },
    });
    const agencyLines =
      (agencyFolio?.charges.length ?? 0) > 0 ||
      (agencyFolio?.payments.some((row) => !row.voidedAt) ?? false);
    if (agencyLines) throw new Error('AGENCY_FOLIO_HAS_LINES');
  }
}
