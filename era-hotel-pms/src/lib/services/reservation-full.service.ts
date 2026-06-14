import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { RESERVATION_NOTE_TYPES } from '@/lib/reservation-note-types';
import type { PaymentMethod, ReservationNoteType } from '@prisma/client';

const fullInclude = {
  room: { include: { roomType: true } },
  roomType: true,
  givenRoomType: true,
  guest: true,
  attachments: { orderBy: { createdAt: 'desc' as const } },
  ratePlan: true,
  mealPlan: true,
  agency: true,
  source: true,
  group: true,
  paxGuests: { orderBy: { sortOrder: 'asc' as const } },
  notes: true,
  dailyRates: { orderBy: { stayDate: 'asc' as const } },
  folios: {
    include: {
      charges: { include: { revenueCode: true } },
      payments: true,
    },
  },
  fiscalDocuments: true,
} as const;

export async function getReservationFull(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: fullInclude,
  });
  if (!reservation) throw new Error('Reservation not found');

  const notesMap = Object.fromEntries(
    reservation.notes.map((n) => [n.noteType, n.text]),
  ) as Partial<Record<ReservationNoteType, string>>;

  for (const nt of RESERVATION_NOTE_TYPES) {
    if (notesMap[nt] === undefined) notesMap[nt] = '';
  }

  return {
    ...reservation,
    totalAmount: decimalToNumber(reservation.totalAmount),
    manualDailyRate: reservation.manualDailyRate
      ? decimalToNumber(reservation.manualDailyRate)
      : null,
    creditLimitAzn: reservation.creditLimitAzn
      ? decimalToNumber(reservation.creditLimitAzn)
      : null,
    isLocked: reservation.isLocked,
    dailyRates: reservation.dailyRates.map((d) => ({
      id: d.id,
      stayDate: d.stayDate,
      amount: decimalToNumber(d.amount),
      currencyCode: d.currencyCode,
      fixPrice: d.fixPrice,
      discountPct: d.discountPct ? decimalToNumber(d.discountPct) : null,
      manualFlag: d.manualFlag,
    })),
    attachments: reservation.attachments,
    notesMap,
  };
}

export async function patchReservationFull(
  id: string,
  input: {
    roomTypeId?: string;
    ratePlanId?: string;
    mealPlanId?: string | null;
    agencyId?: string | null;
    salesContractId?: string | null;
    sourceId?: string | null;
    roomId?: string | null;
    guestId?: string;
    checkInDate?: Date;
    checkOutDate?: Date;
    voucherNo?: string | null;
    roomCount?: number;
    adults?: number;
    children11_6?: number;
    children5_2?: number;
    children1_0?: number;
    market?: string | null;
    segment?: string | null;
    rateType?: string | null;
    booker?: string | null;
    guestRep?: string | null;
    paidBy?: string | null;
    vipType?: string | null;
    accomType?: string | null;
    recordType?: string | null;
    specialStates?: string | null;
    tripReason?: string | null;
    resGroup?: string | null;
    colorCode?: string | null;
    resNo?: string | null;
    shareNo?: string | null;
    optionDate?: Date | null;
    optionState?: string | null;
    salesProject?: string | null;
    useManualRate?: boolean;
    manualDailyRate?: number | null;
    discountActive?: boolean;
    creditLimitAzn?: number | null;
    isLocked?: boolean;
    preferredLocation?: string | null;
    preferredBed?: string | null;
    givenRoomTypeId?: string | null;
    contractRef?: string | null;
    notes?: Partial<Record<ReservationNoteType, string>>;
    paxGuests?: Array<{
      id?: string;
      title?: string | null;
      gender?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      nationality?: string | null;
      birthDate?: string | null;
      age?: number | null;
      idCardNo?: string | null;
      passportNo?: string | null;
      memberNo?: string | null;
      payStatus?: string | null;
      externalResId?: string | null;
      guestState?: string | null;
      isPrimary?: boolean;
    }>;
    dailyRates?: Array<{
      stayDate: string;
      amount: number;
      manualFlag?: boolean;
      currencyCode?: string;
      fixPrice?: boolean;
      discountPct?: number | null;
    }>;
  },
) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw new Error('Reservation not found');

  const { notes, paxGuests, manualDailyRate, creditLimitAzn, dailyRates, ...data } = input;

  await prisma.reservation.update({
    where: { id },
    data: {
      ...data,
      manualDailyRate:
        manualDailyRate === undefined
          ? undefined
          : manualDailyRate === null
            ? null
            : toDecimal(manualDailyRate),
      creditLimitAzn:
        creditLimitAzn === undefined
          ? undefined
          : creditLimitAzn === null
            ? null
            : toDecimal(creditLimitAzn),
    },
  });

  if (notes) {
    for (const [noteType, text] of Object.entries(notes) as [ReservationNoteType, string][]) {
      await prisma.reservationNote.upsert({
        where: {
          reservationId_noteType: { reservationId: id, noteType },
        },
        create: { reservationId: id, noteType, text: text ?? '' },
        update: { text: text ?? '' },
      });
    }
  }

  if (paxGuests) {
    await prisma.reservationGuest.deleteMany({ where: { reservationId: id } });
    await prisma.reservationGuest.createMany({
      data: paxGuests.map((p, i) => ({
        reservationId: id,
        title: p.title ?? null,
        gender: p.gender ?? null,
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        nationality: p.nationality ?? null,
        birthDate: p.birthDate ? new Date(p.birthDate) : null,
        age: p.age ?? null,
        idCardNo: p.idCardNo ?? null,
        passportNo: p.passportNo ?? null,
        memberNo: p.memberNo ?? null,
        payStatus: p.payStatus ?? null,
        externalResId: p.externalResId ?? null,
        guestState: p.guestState ?? null,
        isPrimary: p.isPrimary ?? i === 0,
        sortOrder: i,
      })),
    });
  }

  if (dailyRates?.length) {
    for (const d of dailyRates) {
      const stayDate = new Date(d.stayDate);
      await prisma.reservationDailyRate.upsert({
        where: {
          reservationId_stayDate: { reservationId: id, stayDate },
        },
        create: {
          reservationId: id,
          stayDate,
          amount: toDecimal(d.amount),
          manualFlag: d.manualFlag ?? false,
          currencyCode: d.currencyCode ?? 'AZN',
          fixPrice: d.fixPrice ?? false,
          discountPct:
            d.discountPct === undefined || d.discountPct === null
              ? null
              : toDecimal(d.discountPct),
        },
        update: {
          amount: toDecimal(d.amount),
          manualFlag: d.manualFlag ?? false,
          currencyCode: d.currencyCode ?? 'AZN',
          fixPrice: d.fixPrice ?? false,
          discountPct:
            d.discountPct === undefined || d.discountPct === null
              ? null
              : toDecimal(d.discountPct),
        },
      });
    }
  }

  return getReservationFull(id);
}

export async function listReservationsForGrid(guestId?: string) {
  const rows = await prisma.reservation.findMany({
    where: { groupId: null, ...(guestId ? { guestId } : {}) },
    include: {
      room: true,
      roomType: true,
      guest: true,
      agency: true,
      notes: true,
    },
    orderBy: { checkInDate: 'desc' },
    take: 500,
  });

  return rows.map((r) => {
    const filled = r.notes.filter((n) => (n.text ?? '').trim().length > 0);
    const preview = filled[0]?.text?.trim().slice(0, 80) ?? null;
    return {
      ...r,
      hasNotes: filled.length > 0,
      notePreview: preview,
      noteTypes: filled.map((n) => n.noteType),
    };
  });
}

export async function listGroupReservations() {
  return prisma.reservationGroup.findMany({
    include: {
      agency: true,
      reservations: {
        include: { guest: true, room: true, roomType: true },
        orderBy: { checkInDate: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
}
