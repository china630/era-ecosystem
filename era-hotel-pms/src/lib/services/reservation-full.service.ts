import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { RESERVATION_NOTE_TYPES } from '@/lib/reservation-note-types';
import { ensurePartyGuestFolios } from '@/lib/services/booking-folio.service';
import { normalizeListPagination } from '@era/satellite-kit';
import type { PartyBillingMode, Prisma, ReservationStatus } from '@prisma/client';

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
  paxGuests: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      guest: {
        select: {
          id: true,
          fullName: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
    },
  },
  notes: true,
  dailyRates: { orderBy: { stayDate: 'asc' as const } },
  staySlices: { orderBy: { fromDate: 'asc' as const } },
  roomChanges: {
    orderBy: { effectiveAt: 'asc' as const },
    include: { fromRoom: true, toRoom: true },
  },
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
  ) as Partial<Record<string, string>>;

  for (const nt of RESERVATION_NOTE_TYPES) {
    if (notesMap[nt] === undefined) notesMap[nt] = '';
  }

  let shareNeighbors: Array<{
    id: string;
    guestName: string;
    checkInDate: Date;
    checkOutDate: Date;
  }> = [];
  if (reservation.roomId && reservation.shareEligible) {
    const { listShareNeighborsOnDoor } = await import('@/lib/services/share-assignment.service');
    const neighbors = await listShareNeighborsOnDoor({
      roomId: reservation.roomId,
      checkIn: reservation.checkInDate,
      checkOut: reservation.checkOutDate,
      excludeReservationId: id,
    });
    shareNeighbors = neighbors.map((n) => ({
      id: n.id,
      guestName: n.guest.fullName,
      checkInDate: n.checkInDate,
      checkOutDate: n.checkOutDate,
    }));
  }

  const result = {
    ...reservation,
    totalAmount: decimalToNumber(reservation.totalAmount),
    discountPercent: reservation.discountPercent
      ? decimalToNumber(reservation.discountPercent)
      : null,
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
    packageCompose: null as null | {
      total: number;
      lines: Array<{ role: string; code: string; amount: number; note: string }>;
    },
    attachments: reservation.attachments,
    notesMap,
    shareNeighbors,
  };

  try {
    const { previewComposedPackageSell } = await import(
      '@/lib/services/nafta-package-compose-apply.service'
    );
    result.packageCompose = await previewComposedPackageSell(reservation.id);
  } catch {
    result.packageCompose = null;
  }

  return result;
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
    linenEveryNights?: number | null;
    deepEveryNights?: number | null;
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
    shareEligible?: boolean;
    optionDate?: Date | null;
    optionState?: string | null;
    salesProject?: string | null;
    useManualRate?: boolean;
    manualDailyRate?: number | null;
    discountPercent?: number | null;
    discountActive?: boolean;
    creditLimitAzn?: number | null;
    isLocked?: boolean;
    preferredLocation?: string | null;
    preferredBed?: string | null;
    givenRoomTypeId?: string | null;
    contractRef?: string | null;
    partyBillingMode?: PartyBillingMode;
    notes?: Partial<Record<string, string>>;
    paxGuests?: Array<{
      id?: string;
      guestId?: string | null;
      title?: string | null;
      gender?: string | null;
      sex?: string | null;
      middleName?: string | null;
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
      ownsFolio?: boolean;
      /** FO Guests tab medical SKU (PKG-* or empty). */
      medicalPackageCode?: string | null;
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
  const existing = await prisma.reservation.findUnique({
    where: { id },
    include: { guest: true, paxGuests: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!existing) throw new Error('Reservation not found');

  const { notes, paxGuests, manualDailyRate, creditLimitAzn, dailyRates, shareEligible, ...data } =
    input;

  let nextShareEligible = shareEligible ?? existing.shareEligible;
  let nextShareGender = existing.shareGender;
  if (shareEligible !== undefined) {
    if (!nextShareEligible) {
      if (existing.shareEligible && existing.roomId) {
        const { listShareNeighborsOnDoor } = await import(
          '@/lib/services/share-assignment.service'
        );
        const neighbors = await listShareNeighborsOnDoor({
          roomId: existing.roomId,
          checkIn: existing.checkInDate,
          checkOut: existing.checkOutDate,
          excludeReservationId: id,
        });
        if (neighbors.length > 0) {
          throw new Error(
            `Cannot break share while roommate remains (${neighbors[0]!.guest.fullName}) — relocate first`,
          );
        }
      }
      nextShareGender = null;
    } else {
      const guestForGender =
        data.guestId != null
          ? await prisma.guest.findUnique({ where: { id: data.guestId } })
          : existing.guest;
      const { syncShareGenderFromGuest, validateShareCandidate, reservationIsOta } = await import(
        '@/lib/services/share-assignment.service'
      );
      nextShareGender = syncShareGenderFromGuest(true, guestForGender?.sex);
      validateShareCandidate({
        shareEligible: true,
        shareGender: nextShareGender,
        adults: data.adults ?? existing.adults,
        isOta: await reservationIsOta(id),
      });
    }
  }

  const checkIn = data.checkInDate ?? existing.checkInDate;
  const checkOut = data.checkOutDate ?? existing.checkOutDate;

  let assignShareBedIndex: number | null | undefined;
  let doorShareResolved = false;
  const effectiveRoomId =
    data.roomId !== undefined ? data.roomId : existing.roomId;
  const doorAssignRequested =
    (data.roomId !== undefined && data.roomId !== null && data.roomId !== '') ||
    (Boolean(effectiveRoomId) &&
      effectiveRoomId !== null &&
      (data.checkInDate !== undefined || data.checkOutDate !== undefined));

  if (doorAssignRequested && effectiveRoomId) {
    const { reservationNamesIncomplete } = await import('@/lib/reservation-names');
    const paxForGate = paxGuests ?? existing.paxGuests;
    const adultsForGate = data.adults ?? existing.adults;
    if (
      reservationNamesIncomplete({
        guestFullName: existing.guest.fullName,
        adults: adultsForGate,
        pax: paxForGate,
      })
    ) {
      throw new Error('Guest names incomplete — fill real names before assign');
    }

    const { assertRoomShareAssignable, roomStatusAllowedForShareAssign, reservationIsOta } =
      await import('@/lib/services/share-assignment.service');
    const room = await prisma.room.findUnique({ where: { id: effectiveRoomId } });
    if (!room) throw new Error('Room not found');
    const typeId = data.roomTypeId ?? existing.roomTypeId;
    if (room.roomTypeId !== typeId) {
      const { physicalTypeAllowedForDoor } = await import('@/lib/services/door-type.policy');
      const allowed = physicalTypeAllowedForDoor({
        chargedRoomTypeId: typeId,
        givenRoomTypeId: data.givenRoomTypeId !== undefined ? data.givenRoomTypeId : existing.givenRoomTypeId,
        doorRoomTypeId: room.roomTypeId,
        compUpgrade: false,
      });
      if (!allowed.ok) throw new Error(allowed.error);
    }
    const candidate = {
      shareEligible: nextShareEligible,
      shareGender: nextShareGender,
      adults: data.adults ?? existing.adults,
      isOta: await reservationIsOta(id),
      guestGender: existing.guest.sex,
    };
    const { shareBedIndex, joiningPool, shareEligible: resolvedShare, shareGender: resolvedGender, autoShare } =
      await assertRoomShareAssignable({
        roomId: effectiveRoomId,
        checkIn,
        checkOut,
        excludeReservationId: id,
        candidate,
      });
    assignShareBedIndex = shareBedIndex;
    doorShareResolved = true;
    if (autoShare) {
      nextShareEligible = true;
      nextShareGender = resolvedGender;
    } else if (resolvedShare) {
      nextShareEligible = true;
      nextShareGender = resolvedGender ?? nextShareGender;
    }
    if (!roomStatusAllowedForShareAssign(room, joiningPool)) {
      throw new Error(
        `Room ${room.roomNumber} is ${room.status}; must be AVAILABLE, CLEAN, or INSPECTED to assign`,
      );
    }
  } else if (data.roomId === null) {
    assignShareBedIndex = null;
    nextShareEligible = false;
    nextShareGender = null;
  }

  const { assertShareInventory } = await import('@/lib/services/share-assignment.service');
  await assertShareInventory(existing.roomTypeId, checkIn, checkOut, {
    id,
    shareEligible: nextShareEligible,
    shareGender: nextShareGender,
    adults: data.adults ?? existing.adults,
    roomId: data.roomId !== undefined ? data.roomId : existing.roomId,
  });

  const shareFieldsDirty =
    shareEligible !== undefined || doorShareResolved || assignShareBedIndex !== undefined;

  await prisma.reservation.update({
    where: { id },
    data: {
      ...data,
      ...(shareFieldsDirty
        ? {
            shareEligible: nextShareEligible,
            shareGender: nextShareGender,
            ...(nextShareEligible ? {} : { shareBedIndex: null }),
          }
        : {}),
      ...(assignShareBedIndex !== undefined ? { shareBedIndex: assignShareBedIndex } : {}),
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
      ...(input.discountPercent !== undefined
        ? {
            discountPercent:
              input.discountPercent === null ? null : toDecimal(input.discountPercent),
          }
        : {}),
    },
  });

  if (
    data.roomId !== undefined &&
    data.roomId &&
    data.roomId !== existing.roomId
  ) {
    const { recordRoomMove } = await import('@/lib/services/room-occupancy-log.service');
    await recordRoomMove({
      reservationId: id,
      fromRoomId: existing.roomId,
      toRoomId: data.roomId,
      notes: 'CARD_ASSIGN',
      reasonCode: 'CARD_ASSIGN',
      kind: 'OCCURRED',
      status: 'APPLIED',
    });
  }

  if (notes) {
    for (const [noteType, text] of Object.entries(notes) as [string, string][]) {
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
    const seenGuestIds = new Set<string>();
    for (const p of paxGuests) {
      if (!p.guestId) continue;
      if (seenGuestIds.has(p.guestId)) {
        throw new Error('Same guest cannot appear twice in the party for one room stay');
      }
      seenGuestIds.add(p.guestId);
    }
    await prisma.reservationGuest.deleteMany({ where: { reservationId: id } });
    const primaryIdx = Math.max(
      0,
      paxGuests.findIndex((p) => p.isPrimary),
    );
    const billingMode: PartyBillingMode =
      input.partyBillingMode ?? existing.partyBillingMode;
    await prisma.reservationGuest.createMany({
      data: paxGuests.map((p, i) => {
        const isPrimary = i === primaryIdx;
        const ownsFolio = billingMode === 'EQUAL' ? true : isPrimary;
        return {
          reservationId: id,
          guestId: p.guestId ?? null,
          title: p.title ?? null,
          sex: p.sex ?? p.gender ?? null,
          middleName: p.middleName ?? null,
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
          /** Contact / PRIMARY-mode folio owner */
          isPrimary,
          ownsFolio,
          medicalPackageCode: p.medicalPackageCode?.trim()
            ? p.medicalPackageCode.trim().toUpperCase()
            : null,
          sortOrder: i,
        };
      }),
    });
    if (billingMode === 'EQUAL') {
      await ensurePartyGuestFolios(id);
    }
  }

  if (paxGuests || data.guestId !== undefined || (data.roomId !== undefined && data.roomId)) {
    const { assertNamedGuestsFreeOnStay } = await import('@/lib/services/reservation.service');
    await assertNamedGuestsFreeOnStay(id);
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
          manualFlag: true,
          currencyCode: d.currencyCode ?? 'AZN',
          fixPrice: d.fixPrice ?? false,
          discountPct:
            d.discountPct === undefined || d.discountPct === null
              ? null
              : toDecimal(d.discountPct),
        },
        update: {
          amount: toDecimal(d.amount),
          manualFlag: true,
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

  const datesChanged =
    (data.checkInDate && data.checkInDate.getTime() !== existing.checkInDate.getTime()) ||
    (data.checkOutDate && data.checkOutDate.getTime() !== existing.checkOutDate.getTime());
  const prevPaxCodes = existing.paxGuests
    .map((g) => (g.medicalPackageCode ?? '').toUpperCase())
    .join('|');
  const nextPaxCodes = (paxGuests ?? [])
    .map((p) => (p.medicalPackageCode ?? '').trim().toUpperCase())
    .join('|');
  const paxSkuChanged = Boolean(paxGuests) && prevPaxCodes !== nextPaxCodes;
  const foSkuOverride =
    paxGuests?.some((p) => Boolean(p.medicalPackageCode?.trim())) ?? false;

  if (datesChanged || paxSkuChanged || foSkuOverride) {
    const { stampMedicalPackagesForReservation } = await import(
      '@/lib/services/medical-package-stamp.service'
    );
    const stamped = await stampMedicalPackagesForReservation(
      prisma,
      id,
      foSkuOverride && paxGuests
        ? { foPerGuestCodes: paxGuests.map((p) => p.medicalPackageCode ?? null) }
        : undefined,
    );
    if (stamped.stayKind !== 'leisure') {
      const { dispatchStayProductChanged } = await import(
        '@/lib/integration/guest-lifecycle-events'
      );
      const updated = await prisma.reservation.findUnique({
        where: { id },
        include: { guest: true, room: true, paxGuests: { orderBy: { sortOrder: 'asc' } } },
      });
      if (updated) {
        const previousProgram =
          existing.medicalPackageCode ??
          existing.paxGuests.find((g) => g.medicalPackageCode)?.medicalPackageCode ??
          undefined;
        void dispatchStayProductChanged({
          reservationId: id,
          programCode: stamped.programCode ?? updated.medicalPackageCode ?? undefined,
          previousProgramCode: previousProgram ?? undefined,
          effectiveDate: new Date().toISOString(),
          globalPersonId: updated.guest.globalPersonId ?? undefined,
          roomNumber: updated.room?.roomNumber ?? undefined,
          checkInDate: updated.checkInDate.toISOString(),
          checkOutDate: updated.checkOutDate.toISOString(),
        }).catch((e) => console.error('stay-product amend failed', e));
      }
    }
  }

  // Wave D: refresh composed nightly sell when SKUs or dates known (skip if FO sent manual dailyRates)
  if (!dailyRates?.length) {
    const { syncComposedDailyRates } = await import(
      '@/lib/services/nafta-package-compose-apply.service'
    );
    await syncComposedDailyRates(id);
  }

  return getReservationFull(id);
}

export type ListReservationsForGridQuery = {
  q?: string;
  /** LIVE (default) | ALL | specific ReservationStatus */
  status?: string;
  hasNotes?: boolean;
  guestId?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
};

const LIVE_STATUSES = ['OPTION', 'CONFIRMED', 'IN_HOUSE'] as const;

export async function listReservationsForGrid(
  input: ListReservationsForGridQuery | string = {},
) {
  // Legacy: bare guestId string.
  const opts: ListReservationsForGridQuery =
    typeof input === 'string' ? { guestId: input } : (input ?? {});
  const { page, pageSize, skip } = normalizeListPagination(
    opts.page,
    opts.pageSize,
  );

  const where: Prisma.ReservationWhereInput = {
    groupId: null,
  };
  if (opts.guestId) where.guestId = opts.guestId;

  const statusRaw = (
    opts.status ?? (opts.guestId ? 'ALL' : 'LIVE')
  ).trim();
  if (statusRaw === 'LIVE' || statusRaw === '') {
    where.status = { in: [...LIVE_STATUSES] };
  } else if (statusRaw !== 'ALL') {
    where.status = statusRaw as ReservationStatus;
  }

  if (opts.hasNotes) {
    // Match UI trim(): whitespace-only ≠ has notes (Prisma — no raw SQL for tenant gate).
    const noteRows = await prisma.reservationNote.findMany({
      select: { reservationId: true, text: true },
    });
    const withNotesIds = [
      ...new Set(
        noteRows.filter((n) => n.text.trim().length > 0).map((n) => n.reservationId),
      ),
    ];
    if (withNotesIds.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
    where.id = { in: withNotesIds };
  }

  if (opts.dateFrom || opts.dateTo) {
    where.checkInDate = {};
    if (opts.dateFrom) {
      where.checkInDate.gte = new Date(`${opts.dateFrom}T00:00:00.000Z`);
    }
    if (opts.dateTo) {
      where.checkInDate.lte = new Date(`${opts.dateTo}T23:59:59.999Z`);
    }
  }

  const q = opts.q?.trim();
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { guest: { fullName: { contains: q, mode: 'insensitive' } } },
      { room: { roomNumber: { contains: q, mode: 'insensitive' } } },
      { agency: { code: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        room: true,
        roomType: true,
        guest: true,
        agency: true,
        notes: true,
      },
      orderBy: [{ checkInDate: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  const items = rows.map((r) => {
    const filled = r.notes.filter((n) => (n.text ?? '').trim().length > 0);
    const preview = filled[0]?.text?.trim().slice(0, 80) ?? null;
    return {
      ...r,
      hasNotes: filled.length > 0,
      notePreview: preview,
      noteTypes: filled.map((n) => n.noteType),
    };
  });

  return { items, total, page, pageSize };
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
