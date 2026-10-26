import { prisma } from '@/lib/prisma';
import { addHotelDays, doorClashWindow, hotelDateKey, parseHotelNoon, stayCheckIn } from '@/lib/hotel-calendar';
import { BusinessDateLagError } from '@/lib/business-date-lag';
import { requestOrganizationId } from '@/lib/request-organization';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { assertSanatoriumBookingAllowed } from '@/lib/integration/clinic-capacity-client';
import { isFreeStayBilling } from '@/lib/stay-billing';
import { countNights, decimalToNumber, toDecimal } from '@/lib/decimal';
import { assertActiveForNewUse, assertRoomInventoryAvailable } from '@/lib/master-data/retire-policy';
import { openFoliosForReservation, postCharge } from '@/lib/services/folio.service';
import { hasStopSellInRange } from '@/lib/services/channel.service';
import {
  applyContractRuleToNightly,
  findApplicableContractRule,
} from '@/lib/services/contract-pricing.service';
import { assertContractAllotmentAvailable, getAvailabilityWithContractAllotment } from '@/lib/services/contract-allotment.service';
import {
  assertRoomShareAssignable,
  assertShareInventory,
  countDoorsUsedForRoomType,
  countRemainingInHouseOnDoor,
  isEffectiveShare,
  reservationIsOta,
  resolveDoorAssignment,
  roomStatusAllowedForBooking,
  roomStatusAllowedForShareAssign,
  syncShareGenderFromGuest,
  validateShareCandidate,
} from '@/lib/services/share-assignment.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';
import { contractCounterpartyType } from '@/lib/booking-source-kind';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { paxHasRealName, reservationNamesIncomplete } from '@/lib/reservation-names';
import type { PaymentMethod, ReservationStatus } from '@prisma/client';

export async function listReservations(
  status?: ReservationStatus | ReservationStatus[],
  guestId?: string,
  includeParty = false,
) {
  const statuses = Array.isArray(status) ? status : status ? [status] : [];
  return prisma.reservation.findMany({
    where: {
      ...(statuses.length === 1 ? { status: statuses[0] } : statuses.length > 1 ? { status: { in: statuses } } : {}),
      ...(guestId
        ? includeParty
          ? { OR: [{ guestId }, { paxGuests: { some: { guestId } } }] }
          : { guestId }
        : {}),
    },
    include: {
      room: { include: { roomType: true } },
      roomType: true,
      guest: true,
      ratePlan: true,
      mealPlan: true,
      stay: true,
      folios: { include: { charges: true, payments: true } },
    },
    orderBy: { checkInDate: 'desc' },
  });
}

export async function getReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      room: { include: { roomType: true } },
      roomType: true,
      guest: true,
      ratePlan: true,
      mealPlan: true,
      stay: true,
      folios: { include: { charges: { include: { revenueCode: true } }, payments: true } },
    },
  });
  if (!reservation) throw new Error('Reservation not found');
  return reservation;
}

export async function getAvailability(roomTypeId: string, from: Date, to: Date, excludeReservationId?: string) {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');

  const fromNight = parseHotelNoon(from);
  const toNight = parseHotelNoon(to);
  const booked = await countDoorsUsedForRoomType(roomTypeId, fromNight, toNight, excludeReservationId);

  const stopSell = await hasStopSellInRange(roomTypeId, fromNight, toNight);
  const effectiveQuota = stopSell ? 0 : roomType.baseQuota;

  return {
    quota: roomType.baseQuota,
    booked,
    stopSell,
    available: Math.max(0, effectiveQuota - booked),
  };
}

function isChildAge(age?: number | null, birthDate?: string | null): boolean {
  if (age != null && Number.isFinite(age) && age >= 0 && age < 18) return true;
  if (!birthDate || birthDate.length < 10) return false;
  const y = Number(birthDate.slice(0, 4));
  const m = Number(birthDate.slice(5, 7));
  const d = Number(birthDate.slice(8, 10));
  if (!y || !m || !d) return false;
  const now = new Date();
  let years = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) {
    years -= 1;
  }
  return years >= 0 && years < 18;
}

export async function createReservation(input: {
  roomTypeId: string;
  guestId: string;
  ratePlanId: string;
  mealPlanId?: string;
  roomId?: string;
  givenRoomTypeId?: string;
  sourceId?: string;
  agencyId?: string;
  walkInProfileCode?: string | null;
  companyId?: string;
  salesContractId?: string;
  /** Booking envelope (ReservationGroup) — multi-stay under one group. */
  groupId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  paymentMethod?: PaymentMethod | null;
  adults?: number;
  children11_6?: number;
  children5_2?: number;
  children1_0?: number;
  partyBillingMode?: 'PRIMARY' | 'EQUAL';
  contractRef?: string | null;
  /**
   * When false (group hold / extra rooms), keep pax first/last empty so names-incomplete
   * gate applies and the same booker is not treated as a named claim on every stay.
   */
  copyGuestNameToPax?: boolean;
  shareEligible?: boolean;
  /** Default CONFIRMED; agency portal uses OPTION when auto-confirm is off. */
  status?: 'OPTION' | 'CONFIRMED';
  externalRef?: string;
  market?: string | null;
  segment?: string | null;
  vipType?: string | null;
  tripReason?: string | null;
  booker?: string | null;
  guestRep?: string | null;
  paidBy?: string | null;
  voucherNo?: string | null;
  resNo?: string | null;
  shareNo?: string | null;
  optionDate?: Date | string | null;
  optionState?: string | null;
  salesProject?: string | null;
  specialStates?: string | null;
  resGroup?: string | null;
  colorCode?: string | null;
  preferredLocation?: string | null;
  preferredBed?: string | null;
  creditLimitAzn?: number | null;
  rateType?: string | null;
  accomType?: string | null;
  billingMode?: 'NORMAL' | 'COMP' | 'HOUSE';
  recordType?: string | null;
  useManualRate?: boolean;
  manualDailyRate?: number | null;
  discountPercent?: number | null;
  discountActive?: boolean;
  notes?: Record<string, string>;
  paxGuests?: Array<{
    guestId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    sex?: string | null;
    nationality?: string | null;
    birthDate?: string | null;
    age?: number | null;
    idCardNo?: string | null;
    passportNo?: string | null;
    isPrimary?: boolean;
    ownsFolio?: boolean;
    medicalPackageCode?: string | null;
  }>;
  audit?: { userId?: string | null; request?: Request };
}) {
  let ratePlanId = input.ratePlanId;
  let agencyId = input.agencyId;
  let companyId = input.companyId;
  let salesContractId = input.salesContractId;
  const partyBillingMode = input.partyBillingMode ?? 'PRIMARY';

  if (salesContractId) {
    const contract = await findActiveSalesContract(salesContractId, input.checkInDate);
    if (!contract) throw new Error('Sales contract is not active for check-in date');
    ratePlanId = contract.ratePlanId;
    if (contractCounterpartyType(contract) === 'CORPORATE') {
      companyId = contract.companyId ?? companyId;
    } else if (contract.agencyId) {
      agencyId = contract.agencyId;
    }
    await assertContractAllotmentAvailable(
      salesContractId,
      input.roomTypeId,
      input.checkInDate,
      input.checkOutDate,
    );
  }

  const availability = salesContractId
    ? (
        await getAvailabilityWithContractAllotment(
          input.roomTypeId,
          input.checkInDate,
          input.checkOutDate,
          salesContractId,
        )
      ).available
    : (await getAvailability(input.roomTypeId, input.checkInDate, input.checkOutDate)).available;
  if (availability < 1) throw new Error('No availability for room type');

  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  assertActiveForNewUse(`Room type ${roomType.code}`, roomType.active);

  if (input.givenRoomTypeId) {
    const givenType = await prisma.roomType.findUnique({ where: { id: input.givenRoomTypeId } });
    if (!givenType) throw new Error('Given room type not found');
    assertActiveForNewUse(`Given room type ${givenType.code}`, givenType.active);
  }

  const ratePlan = await prisma.ratePlan.findUnique({ where: { id: ratePlanId } });
  let guestPackageOnStay = false;
  if (ratePlan) {
    const { ratePlanRequiresGuestPackage, normalizeMedicalPackageCode } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    guestPackageOnStay = ratePlanRequiresGuestPackage(ratePlan);
    if (guestPackageOnStay) {
      const named = (input.paxGuests ?? []).filter(
        (p) => p.guestId || p.firstName?.trim() || p.lastName?.trim(),
      );
      const rows = named.length > 0 ? named : [{ medicalPackageCode: null as string | null }];
      if (rows.some((p) => !normalizeMedicalPackageCode(p.medicalPackageCode))) {
        throw new Error('Select a medical package for each guest');
      }
    }
  }
  if (!ratePlan) throw new Error('Rate plan not found');
  assertActiveForNewUse(`Rate plan ${ratePlan.code}`, ratePlan.active);

  const chargedType = await prisma.roomType.findUnique({
    where: { id: input.roomTypeId },
    select: { adultCapacity: true },
  });
  if (!chargedType) throw new Error('Room type not found');
  let adultCap = chargedType.adultCapacity;
  if (input.roomId) {
    const doorCap = await prisma.room.findUnique({
      where: { id: input.roomId },
      select: { maxBed: true },
    });
    if (doorCap?.maxBed != null && doorCap.maxBed > 0) {
      adultCap = Math.min(adultCap, doorCap.maxBed);
    }
  }
  const adultCount = input.adults ?? 1;
  if (adultCount > adultCap) {
    throw new Error(`Adults (${adultCount}) exceed sellable capacity (${adultCap})`);
  }

  const guestMaster = await prisma.guest.findUnique({ where: { id: input.guestId } });
  if (!guestMaster) throw new Error('Guest not found');

  let shareEligible = input.shareEligible ?? false;
  let shareGender: string | null = null;
  let shareBedIndex: number | null = null;
  if (shareEligible) {
    if (agencyId) {
      const agencyForOta = await prisma.agency.findUnique({ where: { id: agencyId } });
      if (
        agencyForOta &&
        (await import('@/lib/booking-source-kind')).isOtaAgency(agencyForOta.code, agencyForOta.name)
      ) {
        throw new Error('OTA reservations cannot use shared twin assignment');
      }
    }
    shareGender = syncShareGenderFromGuest(true, guestMaster.sex);
    validateShareCandidate({
      shareEligible: true,
      shareGender,
      adults: input.adults ?? 1,
    });
    await assertShareInventory(input.roomTypeId, input.checkInDate, input.checkOutDate, {
      shareEligible: true,
      shareGender,
      adults: input.adults ?? 1,
      roomId: input.roomId,
    });
  }

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new Error('Room not found');
    assertRoomInventoryAvailable(room);
    if (room.roomTypeId !== input.roomTypeId) throw new Error('Room does not match room type');
    let agencyOta = false;
    if (agencyId) {
      const agencyForOta = await prisma.agency.findUnique({ where: { id: agencyId } });
      agencyOta = Boolean(
        agencyForOta &&
          (await import('@/lib/booking-source-kind')).isOtaAgency(
            agencyForOta.code,
            agencyForOta.name,
          ),
      );
    }
    const door = await resolveDoorAssignment({
      roomId: input.roomId,
      checkIn: input.checkInDate,
      checkOut: input.checkOutDate,
      candidate: {
        shareEligible,
        shareGender,
        adults: input.adults ?? 1,
        isOta: agencyOta,
        guestGender: guestMaster.sex,
      },
    });
    if (door.autoShare) {
      shareEligible = true;
      shareGender = door.shareGender;
      await assertShareInventory(input.roomTypeId, input.checkInDate, input.checkOutDate, {
        shareEligible: true,
        shareGender,
        adults: input.adults ?? 1,
        roomId: input.roomId,
      });
    }
    shareBedIndex = door.shareBedIndex;
    if (!roomStatusAllowedForBooking(room, door.joiningPool)) {
      throw new Error('Room is not available for booking');
    }
  }

  const copyNames = input.copyGuestNameToPax !== false;
  const guestNameParts = guestMaster.fullName.trim().split(/\s+/).filter(Boolean);
  const paxFirstName = copyNames ? guestNameParts[0] || undefined : undefined;
  const paxLastName = copyNames
    ? guestNameParts.length > 1
      ? guestNameParts.slice(1).join(' ')
      : undefined
    : undefined;

  if (agencyId) {
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new Error('Agency not found');
    assertActiveForNewUse(`Agency ${agency.code}`, agency.active);
  }
  if (input.companyId) {
    const company = await prisma.company.findUnique({ where: { id: input.companyId } });
    if (!company) throw new Error('Company not found');
    assertActiveForNewUse(`Company ${company.code}`, company.active);
  }

  let totalAmount = toDecimal(0);
  if (!ratePlan.medicalFlag) {
    try {
      const quote = await quoteReservationStay({
        ratePlanId,
        roomTypeId: input.roomTypeId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        agencyId,
      });
      totalAmount = toDecimal(quote.totalAmount);
    } catch {
      const nights = countNights(input.checkInDate, input.checkOutDate);
      const baseNightly = decimalToNumber(ratePlan.pricePerNight);
      const rule = await findApplicableContractRule(ratePlanId, input.checkInDate, agencyId);
      const { nightly } = applyContractRuleToNightly(baseNightly, rule);
      totalAmount = toDecimal(nightly * nights);
    }
  }

  const discountPct =
    input.discountActive && input.discountPercent != null
      ? Math.min(100, Math.max(0, Number(input.discountPercent)))
      : 0;
  const manualNightly =
    input.useManualRate && input.manualDailyRate != null && input.manualDailyRate > 0
      ? Math.round(input.manualDailyRate * (1 - discountPct / 100) * 100) / 100
      : null;
  const manualNights = manualNightly == null ? [] : Array.from({ length: countNights(input.checkInDate, input.checkOutDate) }, (_, i) =>
    parseHotelNoon(addHotelDays(input.checkInDate, i)),
  );
  if (manualNightly != null) {
    totalAmount = toDecimal(manualNightly * manualNights.length);
  } else {
    const { usesMedicalPackageCompose, stayProductFamily, MEDICAL_PACKAGE_CODES } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    const stayNights = Array.from(
      { length: countNights(input.checkInDate, input.checkOutDate) },
      (_, i) => parseHotelNoon(addHotelDays(input.checkInDate, i)),
    );
    if (usesMedicalPackageCompose(ratePlan)) {
      const { ownerPackageNightlySell } = await import(
        '@/lib/services/nafta-package-compose-apply.service'
      );
      const { paxCodesForCompose } = await import('@/lib/services/nafta-package-compose.service');
      const named =
        input.paxGuests?.filter(
          (p) => p.guestId || p.firstName?.trim() || p.lastName?.trim() || p.medicalPackageCode?.trim(),
        ) ?? [];
      const raw =
        named.length > 0
          ? paxCodesForCompose(named, ratePlan.code)
          : [ratePlan.code];
      const codes = raw
        .map((c) => (c ?? '').trim().toUpperCase())
        .filter((c) => (MEDICAL_PACKAGE_CODES as readonly string[]).includes(c));
      let sum = 0;
      for (const stayDate of stayNights) {
        const amount = await ownerPackageNightlySell(stayDate, codes, {
          roomTypeId: input.roomTypeId,
          mealPlanId: input.mealPlanId ?? ratePlan.mealPlanId,
        });
        if (amount == null) {
          throw new Error('Package sell price is not set for this stay date');
        }
        sum += amount;
      }
      totalAmount = toDecimal(sum);
    } else if (stayProductFamily(ratePlan) === 'infotur') {
      const { ratePlanGridNightlySell } = await import(
        '@/lib/services/nafta-package-compose-apply.service'
      );
      const mealPlanId = input.mealPlanId ?? ratePlan.mealPlanId;
      let sum = 0;
      for (const stayDate of stayNights) {
        const amount = mealPlanId
          ? await ratePlanGridNightlySell(stayDate, {
              ratePlanId,
              roomTypeId: input.roomTypeId,
              mealPlanId,
              occupancy: Math.max(1, input.adults ?? 1),
            })
          : null;
        if (amount == null) {
          throw new Error('Package sell price is not set for this stay date');
        }
        sum += amount;
      }
      totalAmount = toDecimal(sum);
    }
  }

  const contractRef =
    input.contractRef ||
    (salesContractId
      ? (await prisma.salesContract.findUnique({ where: { id: salesContractId }, select: { code: true } }))
          ?.code
      : undefined);

  const reservation = await prisma.$transaction(async (tx) => {
    const created = await tx.reservation.create({
      data: {
        organizationId: requestOrganizationId(),
        roomTypeId: input.roomTypeId,
        givenRoomTypeId: input.givenRoomTypeId,
        guestId: input.guestId,
        ratePlanId,
        mealPlanId: input.mealPlanId,
        roomId: input.roomId,
        sourceId: input.sourceId,
        agencyId,
        walkInProfileCode: input.walkInProfileCode ?? null,
        companyId,
        salesContractId,
        groupId: input.groupId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        paymentMethod: input.paymentMethod ?? null,
        totalAmount,
        /** Variant A: one Reservation = one room stay */
        roomCount: 1,
        adults: input.adults ?? 1,
        children11_6: input.children11_6 ?? 0,
        children5_2: input.children5_2 ?? 0,
        children1_0: input.children1_0 ?? 0,
        partyBillingMode,
        contractRef,
        shareEligible,
        shareGender,
        shareBedIndex,
        status: input.status ?? 'CONFIRMED',
        externalRef: input.externalRef,
        market: input.market ?? undefined,
        segment: input.segment ?? undefined,
        vipType: input.vipType ?? undefined,
        tripReason: input.tripReason ?? undefined,
        booker: input.booker ?? undefined,
        guestRep: input.guestRep ?? undefined,
        paidBy: input.paidBy ?? undefined,
        voucherNo: input.voucherNo ?? undefined,
        resNo: input.resNo ?? undefined,
        shareNo: input.shareNo ?? undefined,
        optionDate: input.optionDate ? new Date(input.optionDate) : undefined,
        optionState: input.optionState ?? undefined,
        salesProject: input.salesProject ?? undefined,
        specialStates: input.specialStates ?? undefined,
        resGroup: input.resGroup ?? undefined,
        colorCode: input.colorCode ?? undefined,
        preferredLocation: input.preferredLocation ?? undefined,
        preferredBed: input.preferredBed ?? undefined,
        creditLimitAzn:
          input.creditLimitAzn != null ? toDecimal(input.creditLimitAzn) : undefined,
        rateType: input.rateType ?? undefined,
        accomType: input.accomType ?? undefined,
        billingMode: input.billingMode ?? undefined,
        recordType: input.recordType ?? undefined,
        useManualRate: input.useManualRate ?? false,
        manualDailyRate:
          input.manualDailyRate != null ? toDecimal(input.manualDailyRate) : undefined,
        discountPercent:
          input.discountPercent != null ? toDecimal(input.discountPercent) : undefined,
        discountActive: input.discountActive ?? false,
        ...(manualNightly != null
          ? {
              dailyRates: {
                create: manualNights.map((stayDate) => ({
                  stayDate,
                  amount: toDecimal(manualNightly),
                  manualFlag: true,
                  fixPrice: true,
                  currencyCode: 'AZN',
                  discountPct: discountPct > 0 ? toDecimal(discountPct) : undefined,
                })),
              },
            }
          : {}),
        paxGuests: {
          create:
            input.paxGuests && input.paxGuests.length > 0
              ? input.paxGuests.map((p, i) => {
                  const primaryAt = input.paxGuests!.some((row) => row.isPrimary)
                    ? input.paxGuests!.findIndex((row) => row.isPrimary)
                    : 0;
                  const isPrimary = i === primaryAt;
                  return {
                    guestId: p.guestId || null,
                    firstName: p.firstName ?? null,
                    lastName: p.lastName ?? null,
                    middleName: p.middleName ?? null,
                    sex: p.sex ?? null,
                    nationality: p.nationality ?? null,
                    birthDate: p.birthDate ? new Date(p.birthDate) : null,
                    age: p.age ?? null,
                    idCardNo: p.idCardNo ?? null,
                    passportNo: p.passportNo ?? null,
                    isPrimary,
                    ownsFolio: true,
                    medicalPackageCode:
                      guestPackageOnStay && p.medicalPackageCode?.trim()
                        ? p.medicalPackageCode.trim().toUpperCase()
                        : null,
                    sortOrder: i,
                  };
                })
              : {
                  guestId: input.guestId,
                  firstName: paxFirstName ?? null,
                  lastName: paxLastName ?? null,
                  isPrimary: true,
                  ownsFolio: true,
                  sortOrder: 0,
                },
        },
        staySlices: {
          create: {
            fromDate: input.checkInDate,
            toDate: input.checkOutDate,
            roomTypeId: input.roomTypeId,
            ratePlanId,
            roomId: input.roomId ?? null,
          },
        },
      },
      include: { room: true, roomType: true, guest: true, ratePlan: true, agency: true },
    });

    return created;
  });

  if (input.notes) {
    for (const [noteType, text] of Object.entries(input.notes)) {
      if (!text?.trim()) continue;
      await prisma.reservationNote.upsert({
        where: { reservationId_noteType: { reservationId: reservation.id, noteType } },
        create: { reservationId: reservation.id, noteType, text },
        update: { text },
      });
    }
  }

  {
    const { stampMedicalPackagesForReservation } = await import(
      '@/lib/services/medical-package-stamp.service'
    );
    const foCodes = input.paxGuests?.map((p) => {
      const own = p.medicalPackageCode?.trim();
      return own ? own : null;
    });
    const stamped = await stampMedicalPackagesForReservation(
      prisma,
      reservation.id,
      {
        ...(foCodes ? { foPerGuestCodes: foCodes } : {}),
        inheritRatePlanPackage: false,
      },
    );
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (isFreeStayBilling(input.billingMode)) {
      const { recalcReservationDailyRates } = await import(
        '@/lib/services/reservation-pricing.service'
      );
      await recalcReservationDailyRates(reservation.id);
    } else if (manualNightly == null && usesMedicalPackageCompose(ratePlan)) {
      const { syncComposedDailyRates } = await import(
        '@/lib/services/nafta-package-compose-apply.service'
      );
      const composed = await syncComposedDailyRates(reservation.id);
      if (composed.missing || !composed.applied) {
        throw new Error('Package sell price is not set for this stay date');
      }
    } else if (manualNightly == null && !usesMedicalPackageCompose(ratePlan) && input.mealPlanId) {
      const { ratePlanGridNightlySell } = await import(
        '@/lib/services/nafta-package-compose-apply.service'
      );
      const sample = await ratePlanGridNightlySell(input.checkInDate, {
        ratePlanId,
        roomTypeId: input.roomTypeId,
        mealPlanId: input.mealPlanId,
        occupancy: Math.max(1, input.adults ?? 1),
      });
      if (sample != null) {
        const { recalcReservationDailyRates } = await import(
          '@/lib/services/reservation-pricing.service'
        );
        await recalcReservationDailyRates(reservation.id);
      }
    }
    if (stamped.stayKind !== 'leisure' && stamped.perGuestCodes.some((code) => code != null)) {
      await assertSanatoriumBookingAllowed(reservation.organizationId, reservation.checkInDate);
      const party = await prisma.reservationGuest.findMany({
        where: { reservationId: reservation.id },
        orderBy: { sortOrder: 'asc' },
        include: { guest: true },
      });
      const room = reservation.roomId
        ? await prisma.room.findUnique({
            where: { id: reservation.roomId },
            select: { roomNumber: true },
          })
        : null;
      const { fanOutClinicMedicalPackages } = await import(
        '@/lib/integration/guest-lifecycle-events'
      );
      void fanOutClinicMedicalPackages({
        status: reservation.status,
        reservationId: reservation.id,
        roomNumber: room?.roomNumber,
        checkInDate: reservation.checkInDate.toISOString(),
        checkOutDate: reservation.checkOutDate.toISOString(),
        pax: party,
      }).catch((e) => console.error('sanatorium booking created failed', e));
    }
  }

  const { loadReservationAuditSnapshot, recordReservationDiff } = await import(
    '@/lib/reservation-audit'
  );
  const afterCreate = await loadReservationAuditSnapshot(reservation.id);
  await recordReservationDiff(reservation.id, 'CREATE', null, afterCreate, input.audit);
  return reservation;
}

export async function assignRoom(
  reservationId: string,
  roomId: string,
  audit?: { userId?: string | null; request?: Request },
) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      paxGuests: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!['CONFIRMED', 'OPTION'].includes(reservation.status)) {
    throw new Error('Assign is only allowed for CONFIRMED or OPTION reservations');
  }

  const { reservationNamesIncomplete } = await import('@/lib/reservation-names');
  if (
    reservationNamesIncomplete({
      guestFullName: reservation.guest.fullName,
      adults: reservation.adults,
      pax: reservation.paxGuests,
    })
  ) {
    throw new Error('Guest names incomplete — fill real names before assign');
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');
  const otherType = room.roomTypeId !== reservation.roomTypeId;
  if (otherType) {
    const { physicalTypeAllowedForDoor } = await import('@/lib/services/door-type.policy');
    const allowed = physicalTypeAllowedForDoor({
      chargedRoomTypeId: reservation.roomTypeId,
      givenRoomTypeId: reservation.givenRoomTypeId ?? room.roomTypeId,
      doorRoomTypeId: room.roomTypeId,
      compUpgrade: true,
    });
    if (!allowed.ok) throw new Error(allowed.error);
  }

  const { shareBedIndex, joiningPool, shareEligible: resolvedShare, shareGender: resolvedGender, autoShare } =
    await assertRoomShareAssignable({
      roomId,
      checkIn: reservation.checkInDate,
      checkOut: reservation.checkOutDate,
      excludeReservationId: reservationId,
      candidate: {
        shareEligible: reservation.shareEligible,
        shareGender: reservation.shareGender ?? reservation.guest.sex,
        adults: reservation.adults,
        isOta: await reservationIsOta(reservationId),
        guestGender: reservation.guest.sex,
      },
    });
  if (!roomStatusAllowedForBooking(room, joiningPool)) {
    throw new Error(
      `Room ${room.roomNumber} is ${room.status}; out of service and cannot be reserved`,
    );
  }
  await assertNamedGuestsFreeOnStay(reservationId);

  const fromRoomId = reservation.roomId;
  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      roomId,
      shareBedIndex,
      ...(autoShare || resolvedShare
        ? { shareEligible: true, shareGender: resolvedGender ?? reservation.shareGender }
        : {}),
      ...(otherType ? { givenRoomTypeId: room.roomTypeId } : {}),
    },
    include: { room: true, guest: true, roomType: true, ratePlan: true },
  });
  if (fromRoomId !== roomId) {
    const { recordRoomMove } = await import('@/lib/services/room-occupancy-log.service');
    await recordRoomMove({
      reservationId,
      fromRoomId,
      toRoomId: roomId,
      notes: 'CARD_ASSIGN',
      reasonCode: 'CARD_ASSIGN',
    });
    if (fromRoomId) {
      const { moveStayDoor } = await import('./stay-slice.service');
      await moveStayDoor({
        reservationId,
        fromRoomId,
        toRoomId: roomId,
        status: reservation.status,
        checkIn: reservation.checkInDate,
      });
    }
  }
  const fromRoom = fromRoomId
    ? await prisma.room.findUnique({ where: { id: fromRoomId }, select: { roomNumber: true } })
    : null;
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(reservationId, 'ASSIGN_ROOM', audit, {
    section: 'card',
    source: 'user',
    fields: [
      {
        key: 'roomNumber',
        from: fromRoom?.roomNumber ?? null,
        to: updated.room?.roomNumber ?? room.roomNumber,
      },
    ],
  });
  return updated;
}

export async function listArrivals(from: Date | string, to: Date | string = from) {
  const fromKey = hotelDateKey(from);
  const toKey = hotelDateKey(to);
  const lo = fromKey <= toKey ? fromKey : toKey;
  const hi = fromKey <= toKey ? toKey : fromKey;
  const start = new Date(`${lo}T00:00:00.000Z`);
  const end = new Date(`${hi}T23:59:59.999Z`);

  return prisma.reservation.findMany({
    where: {
      checkInDate: { gte: start, lte: end },
      status: { in: ['CONFIRMED', 'OPTION'] },
    },
    include: { guest: true, roomType: true, room: true, ratePlan: true },
    orderBy: { checkInDate: 'asc' },
  });
}

export async function checkInReservation(
  id: string,
  opts?: {
    early?: boolean;
    checkInTime?: string;
    audit?: { userId?: string | null; request?: Request };
  },
) {
  const { assertBusinessDayOpenForPosting, getCurrentBusinessDate } = await import(
    '@/lib/services/business-date.service'
  );
  await assertBusinessDayOpenForPosting();

  let reservation = await getReservation(id);
  if (!['CONFIRMED', 'OPTION'].includes(reservation.status)) {
    throw new Error('Check-in is only allowed for CONFIRMED or OPTION reservations');
  }
  if (!reservation.roomId) throw new Error('Assign a room before check-in');

  const { collectStayOperationalGaps } = await import(
    '@/lib/services/stay-operational-readiness.service'
  );
  const { StayCheckInBlockedError } = await import('@/lib/guest-stay-requirements');
  const operationalGaps = await collectStayOperationalGaps(id);
  if (operationalGaps.length > 0) throw new StayCheckInBlockedError(operationalGaps);

  const biz = await getCurrentBusinessDate();
  const bizKey = hotelDateKey(biz);
  let arrivalKey = hotelDateKey(reservation.checkInDate);
  if (arrivalKey > bizKey && !opts?.early) {
    const wallToday = todayBakuYmd();
    if (arrivalKey <= wallToday) {
      throw new BusinessDateLagError(bizKey, arrivalKey);
    }
    throw new Error(
      'Check-in opens on the arrival date. Confirm early check-in to receive the guest sooner.',
    );
  }
  const { isFreeStayBilling } = await import('@/lib/stay-billing');
  const priorStay = await prisma.stay.findFirst({
    where: { reservationId: id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  // Re-check-in after checkout keeps the lived nights. Moving the arrival onto
  // the business date and rebuilding rates is only for a guest who never arrived.
  let nextCheckIn: Date | null = null;
  if (!priorStay && !opts?.early && arrivalKey < bizKey && reservation.roomId) {
    nextCheckIn = stayCheckIn(bizKey);
  }
  const rebuildRates =
    nextCheckIn != null || (!priorStay && isFreeStayBilling(reservation.billingMode));
  if (priorStay) {
    const cityLedger = await prisma.folio.count({
      where: { reservationId: id, status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] } },
    });
    if (cityLedger > 0) {
      throw Object.assign(new Error('City-ledger checkout cannot be checked in again'), {
        status: 409,
        code: 'CITY_LEDGER_CHECKIN',
      });
    }
  }
  const room = await prisma.room.findUnique({ where: { id: reservation.roomId! } });
  if (room) {
    const physicalTypeId = reservation.givenRoomTypeId ?? reservation.roomTypeId;
    if (room.roomTypeId !== physicalTypeId) {
      throw new Error(
        'Assigned Room no. does not match Given room type — re-assign the door before check-in',
      );
    }
  }
  const othersInHouse = reservation.roomId
    ? await countRemainingInHouseOnDoor(reservation.roomId, id)
    : 0;
  const joiningSharePool =
    reservation.shareEligible &&
    isEffectiveShare({
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
    }) &&
    othersInHouse > 0;
  if (priorStay) {
    if (!room || (room.inventoryStatus && room.inventoryStatus !== 'IN_SERVICE')) {
      throw new Error(`Room ${room?.roomNumber ?? ''} is out of inventory`);
    }
  } else if (
    !room ||
    (!joiningSharePool && !roomStatusAllowedForShareAssign(room, false))
  ) {
    throw new Error(
      `Room ${room?.roomNumber ?? ''} is ${room?.status ?? 'missing'}; must be CLEAN or INSPECTED to assign`,
    );
  }
  if (joiningSharePool && room && !roomStatusAllowedForShareAssign(room, true)) {
    throw new Error(`Room ${room.roomNumber} is out of inventory`);
  }
  await assertNamedGuestsFreeOnStay(id);

  if (
    !reservation.useManualRate &&
    !isFreeStayBilling(reservation.billingMode)
  ) {
    const {
      ratePlanRequiresGuestPackage,
      normalizeMedicalPackageCode,
      MEDICAL_PACKAGE_CODES,
      usesMedicalPackageCompose,
    } =
      await import('@/lib/services/medical-package-resolve.service');
    const party = await prisma.reservationGuest.findMany({
      where: { reservationId: id },
      orderBy: { sortOrder: 'asc' },
      select: {
        medicalPackageCode: true,
        firstName: true,
        lastName: true,
        guestId: true,
      },
    });
    if (ratePlanRequiresGuestPackage(reservation.ratePlan)) {
      const named =
        party.length > 0
          ? party.filter(
              (p) => p.guestId || p.firstName?.trim() || p.lastName?.trim(),
            )
          : party;
      const rows = named.length > 0 ? named : party;
      if (rows.length === 0 || rows.some((p) => !normalizeMedicalPackageCode(p.medicalPackageCode))) {
        throw new Error('Select a medical package for each guest');
      }
    }
    if (usesMedicalPackageCompose(reservation.ratePlan)) {
      const { ownerPackageNightlySell } = await import(
        '@/lib/services/nafta-package-compose-apply.service'
      );
      const { paxCodesForCompose } = await import('@/lib/services/nafta-package-compose.service');
      const raw =
        party.length > 0
          ? paxCodesForCompose(party, null)
          : [reservation.medicalPackageCode];
      const codes = raw
        .map((c) => (c ?? '').trim().toUpperCase())
        .filter((c) => (MEDICAL_PACKAGE_CODES as readonly string[]).includes(c));
      const stored = await prisma.reservationDailyRate.findMany({ where: { reservationId: id } });
      const rateArrival = nextCheckIn ?? reservation.checkInDate;
      const nightCount = countNights(rateArrival, reservation.checkOutDate);
      for (let i = 0; i < nightCount; i++) {
        const stayDate = parseHotelNoon(addHotelDays(rateArrival, i));
        const row = stored.find((d) => hotelDateKey(d.stayDate) === hotelDateKey(stayDate));
        if (row) continue;
        const amount = await ownerPackageNightlySell(stayDate, codes, {
          roomTypeId: reservation.roomTypeId,
          mealPlanId: reservation.mealPlanId,
        });
        if (amount == null) {
          throw new Error('Package sell price is not set for an open night');
        }
      }
    }
  }

  const doorCap = room?.maxBed;
  const typeCap = reservation.roomType?.adultCapacity ?? 2;
  const sellCap = doorCap != null && doorCap > 0 ? Math.min(typeCap, doorCap) : typeCap;
  if (reservation.adults > sellCap) {
    throw new Error(`Adults (${reservation.adults}) exceed sellable capacity (${sellCap})`);
  }

  const previousCheckIn = reservation.checkInDate;
  let pulledArrival = false;
  if (!priorStay && opts?.early && arrivalKey > bizKey && reservation.roomId) {
    pulledArrival = true;
    const clash = await prisma.reservation.findFirst({
      where: {
        id: { not: id },
        roomId: reservation.roomId,
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
        checkInDate: { lt: reservation.checkInDate },
        checkOutDate: { gt: stayCheckIn(bizKey) },
      },
      select: { id: true },
    });
    if (clash) throw new Error('Room is occupied on the extra nights');
    await prisma.reservation.update({
      where: { id },
      data: { checkInDate: stayCheckIn(bizKey) },
    });
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (usesMedicalPackageCompose(reservation.ratePlan)) {
      const { syncComposedDailyRates } = await import(
        '@/lib/services/nafta-package-compose-apply.service'
      );
      const composed = await syncComposedDailyRates(id);
      if (composed.missing) {
        throw new Error('Package sell price is not set for this stay date');
      }
    } else {
      const { recalcReservationDailyRates } = await import(
        '@/lib/services/reservation-pricing.service'
      );
      await recalcReservationDailyRates(id);
    }
    reservation = await getReservation(id);
    arrivalKey = hotelDateKey(reservation.checkInDate);
  }

  return prisma.$transaction(async (tx) => {
    if (nextCheckIn) {
      await tx.reservation.update({
        where: { id },
        data: { checkInDate: nextCheckIn },
      });
    }
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: 'IN_HOUSE' },
      include: { room: true, guest: true, ratePlan: true, roomType: true },
    });
    if (priorStay) {
      await tx.stay.update({
        where: { id: priorStay.id },
        data: { actualCheckOut: null },
      });
      await tx.folio.updateMany({
        where: { reservationId: id, type: 'GUEST', status: 'CLOSED' },
        data: { status: 'OPEN' },
      });
    } else {
      await tx.stay.create({
        data: { reservationId: id, actualCheckIn: new Date() },
      });
    }
    if (updated.roomId) {
      const { writeInServiceDoorHk } = await import('@/lib/services/room.service');
      await writeInServiceDoorHk(updated.roomId, 'DIRTY', tx);
    }

    return updated;
  }).then(async (updated) => {
    if (rebuildRates) {
      try {
        const { recalcReservationDailyRates } = await import(
          '@/lib/services/reservation-pricing.service'
        );
        await recalcReservationDailyRates(id);
      } catch (err) {
        console.error('Check-in rate rebuild failed', err);
      }
    }
    const { ensurePrimaryAndGuestFolios } = await import('@/lib/services/booking-folio.service');
    await ensurePrimaryAndGuestFolios(id);
    await openFoliosForReservation(id);
    const { moveHeldDepositsOntoFolio } = await import('@/lib/services/folio-deposit.service');
    await moveHeldDepositsOntoFolio(id);

    const { postEarlyCheckInFee } = await import('@/lib/services/early-late-fees.service');
    if (opts?.checkInTime && opts.checkInTime < '14:00') {
      void postEarlyCheckInFee(id, opts.checkInTime).catch((e) =>
        console.error('Early check-in fee failed', e),
      );
    }

    const result = await getReservation(id);
    const { submitTourismCheckIn } = await import('@/lib/services/tourism.service');
    void submitTourismCheckIn(id).catch((e) => console.error('Tourism check-in failed', e));
    const { stampMedicalPackagesForReservation } = await import(
      '@/lib/services/medical-package-stamp.service'
    );
    const storedPax = await prisma.reservationGuest.findMany({
      where: { reservationId: id },
      orderBy: { sortOrder: 'asc' },
      select: { medicalPackageCode: true },
    });
    const stamped = await stampMedicalPackagesForReservation(
      prisma,
      id,
      {
        ...(storedPax.length > 0
          ? { foPerGuestCodes: storedPax.map((g) => g.medicalPackageCode) }
          : {}),
        inheritRatePlanPackage: false,
      },
    );
    const full = await prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        room: true,
        ratePlan: { select: { code: true } },
        paxGuests: {
          orderBy: { sortOrder: 'asc' },
          include: { guest: true },
        },
      },
    });
    // Clinic follows the packages on the guests. The agency name does not mute them.
    // A stay with no package (Walk-in Leisure tariff) sends nothing.
    if (full) {
      const { dispatchGuestCheckedIn, lifecycleDemographicsFromPax } = await import(
        '@/lib/integration/guest-lifecycle-events'
      );
      const { paxLifecycleGlobalPersonId } = await import(
        '@/lib/integration/pax-lifecycle-person'
      );
      const paxList =
        full && full.paxGuests.length > 0
          ? full.paxGuests
          : full
            ? [
                {
                  medicalPackageCode: full.medicalPackageCode,
                  firstName: full.guest.firstName,
                  lastName: full.guest.lastName,
                  guest: full.guest,
                },
              ]
            : [];
      const { normalizeMedicalPackageCode } = await import(
        '@/lib/services/medical-package-resolve.service'
      );
      for (const pax of paxList) {
        const name =
          [pax.firstName, pax.lastName].filter(Boolean).join(' ') ||
          pax.guest?.fullName ||
          full?.guest.fullName ||
          'Guest';
        const paxKey =
          'id' in pax && typeof (pax as { id?: string }).id === 'string'
            ? (pax as { id: string }).id
            : pax.guest?.id ?? undefined;
        const programCode = normalizeMedicalPackageCode(pax.medicalPackageCode);
        if (!programCode) continue;
        void dispatchGuestCheckedIn({
          reservationId: id,
          roomNumber: updated.room?.roomNumber ?? undefined,
          programCode,
          globalPersonId: paxLifecycleGlobalPersonId({
            isPrimary: "isPrimary" in pax ? Boolean(pax.isPrimary) : false,
            guestId: "guestId" in pax ? pax.guestId : pax.guest?.id,
            guest: pax.guest,
            primaryGuest: updated.guest,
          }),
          guestName: name,
          checkInDate: reservation.checkInDate.toISOString(),
          checkOutDate: reservation.checkOutDate.toISOString(),
          paxKey,
          ...lifecycleDemographicsFromPax(pax),
        }).catch((e) => console.error('Guest lifecycle check-in failed', e));
      }
      if (full && !priorStay) {
        const { usesMedicalPackageCompose } = await import(
          '@/lib/services/medical-package-resolve.service'
        );
        if (usesMedicalPackageCompose(full.ratePlan)) {
          const { syncComposedDailyRates } = await import(
            '@/lib/services/nafta-package-compose-apply.service'
          );
          await syncComposedDailyRates(id);
        } else {
          const { recalcReservationDailyRates } = await import(
            '@/lib/services/reservation-pricing.service'
          );
          await recalcReservationDailyRates(id);
        }
      }
    }
    if (
      process.env.ERA_DOOR_LOCK_ENABLED === '1' &&
      updated.room?.roomNumber
    ) {
      const { getDoorLockAdapter } = await import(
        '@/lib/integrations/door-lock-adapter'
      );
      void getDoorLockAdapter()
        .unlockRoom({
          roomNumber: updated.room.roomNumber,
          reservationId: id,
        })
        .catch((e) => console.error('Door lock unlock on check-in failed', e));
    }
    const { recordReservationAudit } = await import('@/lib/reservation-audit');
    await recordReservationAudit(id, opts?.early ? 'CHECK_IN_EARLY' : 'CHECK_IN', opts?.audit, {
      section: 'status',
      source: 'user',
      fields: [{ key: 'status', from: reservation.status, to: 'IN_HOUSE' }],
    });
    return result;
  });
}

export async function cancelReservation(
  id: string,
  noShow = false,
  reason?: string,
  audit?: { userId?: string | null; request?: Request },
) {
  const reservation = await getReservation(id);
  if (['CHECKED_OUT', 'CANCELLED'].includes(reservation.status)) {
    throw new Error('Reservation already closed');
  }
  const cancelReason = reason?.trim() ?? '';
  if (!noShow && !cancelReason) throw new Error('CANCEL_REASON_REQUIRED');

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: {
        status: noShow ? 'NO_SHOW' : 'CANCELLED',
        shareBedIndex: null,
      },
      include: { room: true, guest: true },
    });
    if (!noShow) {
      await tx.reservationNote.upsert({
        where: { reservationId_noteType: { reservationId: id, noteType: 'CANCEL_NOTE' } },
        create: {
          organizationId: reservation.organizationId,
          reservationId: id,
          noteType: 'CANCEL_NOTE',
          text: cancelReason,
        },
        update: { text: cancelReason },
      });
    }
    if (reservation.roomId) {
      const { releaseDoorAfterShareDeparture } = await import(
        '@/lib/services/share-assignment.service'
      );
      await releaseDoorAfterShareDeparture(tx, {
        roomId: reservation.roomId,
        excludeReservationId: id,
        shareBedIndex: reservation.shareBedIndex,
        wasInHouse: reservation.status === 'IN_HOUSE',
      });
    }
    return updated;
  });
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(id, noShow ? 'NO_SHOW' : 'CANCEL', audit, {
    section: 'status',
    source: 'user',
    fields: [
      { key: 'status', from: reservation.status, to: noShow ? 'NO_SHOW' : 'CANCELLED' },
      ...(reason?.trim() ? [{ key: 'reason', from: null, to: reason.trim() }] : []),
    ],
  });
  return cancelled;
}

/** Put a cancelled stay back on the books. The door and type must still be free, or the desk picks another. */
export async function restoreReservation(
  id: string,
  input: { roomId?: string | null; roomTypeId?: string; audit?: { userId?: string | null; request?: Request } },
) {
  const reservation = await getReservation(id);
  if (reservation.status !== 'CANCELLED') {
    throw new Error('Only a cancelled reservation can be restored');
  }
  const roomTypeId = input.roomTypeId || reservation.roomTypeId;
  const roomId = input.roomId === undefined ? reservation.roomId : input.roomId;

  let shareBedIndex: number | null = null;
  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== roomTypeId) {
      throw new Error('Room does not match the room type');
    }
    const door = await assertRoomShareAssignable({
      roomId,
      checkIn: reservation.checkInDate,
      checkOut: reservation.checkOutDate,
      excludeReservationId: id,
      candidate: {
        shareEligible: reservation.shareEligible,
        shareGender: reservation.shareGender,
        adults: reservation.adults,
        isOta: await reservationIsOta(id),
        guestGender: reservation.guest.sex,
      },
    });
    if (!roomStatusAllowedForBooking(room, door.joiningPool)) {
      throw new Error(`Room ${room.roomNumber} is not available`);
    }
    shareBedIndex = door.shareBedIndex;
  }

  await assertShareInventory(roomTypeId, reservation.checkInDate, reservation.checkOutDate, {
    id,
    shareEligible: reservation.shareEligible,
    shareGender: reservation.shareGender,
    adults: reservation.adults,
    roomId: roomId ?? null,
  });

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      roomTypeId,
      roomId: roomId ?? null,
      shareBedIndex,
    },
    include: { room: true, guest: true, ratePlan: true, roomType: true },
  });

  if (reservation.roomId && reservation.roomId !== (roomId ?? null)) {
    const { moveStayDoor } = await import('./stay-slice.service');
    await moveStayDoor({
      reservationId: id,
      fromRoomId: reservation.roomId,
      toRoomId: roomId ?? null,
      status: 'CONFIRMED',
      checkIn: reservation.checkInDate,
    });
  }
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(id, 'RESTORE', input.audit, {
    section: 'status',
    source: 'user',
    fields: [{ key: 'status', from: 'CANCELLED', to: 'CONFIRMED' }],
  });
  return updated;
}

const SCHEDULABLE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;
const BLOCKED_ROOM_STATUSES = ['OOO', 'OOS'] as const;

/** Guest ids that are a real named claim on this stay (not TBA / empty pax). */
export function namedGuestIdsOnStay(input: {
  guestId: string;
  guestFullName?: string | null;
  adults: number;
  pax: Array<{
    guestId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const row of input.pax) {
    if (row.guestId && paxHasRealName(row)) ids.add(row.guestId);
  }
  if (
    !reservationNamesIncomplete({
      guestFullName: input.guestFullName,
      adults: input.adults,
      pax: input.pax,
    })
  ) {
    ids.add(input.guestId);
  }
  return [...ids];
}

export type NamedGuestOverlap = {
  guestId: string;
  reservationId: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
};

/**
 * Same named guest on overlapping stays is allowed. Returns warnings only.
 * TBA booker holds (incomplete names) do not claim the person.
 */
export async function listNamedGuestOverlaps(reservationId: string): Promise<NamedGuestOverlap[]> {
  const stay = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, paxGuests: true, room: true },
  });
  if (!stay) throw new Error('Reservation not found');

  const claimed = namedGuestIdsOnStay({
    guestId: stay.guestId,
    guestFullName: stay.guest.fullName,
    adults: stay.adults,
    pax: stay.paxGuests,
  });
  if (claimed.length === 0) return [];

  const warnings: NamedGuestOverlap[] = [];
  for (const guestId of claimed) {
    const conflict = await prisma.reservation.findFirst({
      where: {
        id: { not: reservationId },
        status: { in: [...SCHEDULABLE_STATUSES] },
        checkInDate: { lt: stay.checkOutDate },
        checkOutDate: { gt: stay.checkInDate },
        OR: [{ guestId }, { paxGuests: { some: { guestId } } }],
      },
      include: {
        guest: true,
        room: true,
        paxGuests: true,
      },
    });
    if (!conflict) continue;

    const otherClaimed = namedGuestIdsOnStay({
      guestId: conflict.guestId,
      guestFullName: conflict.guest.fullName,
      adults: conflict.adults,
      pax: conflict.paxGuests,
    });
    if (!otherClaimed.includes(guestId)) continue;

    warnings.push({
      guestId,
      reservationId: conflict.id,
      roomNumber: conflict.room?.roomNumber ?? 'TBA',
      checkIn: conflict.checkInDate.toISOString().slice(0, 10),
      checkOut: conflict.checkOutDate.toISOString().slice(0, 10),
    });
  }
  return warnings;
}

/** Create-path warning: named guest already on another overlapping stay. */
export async function listDraftGuestOverlaps(
  guestIds: string[],
  checkIn: Date,
  checkOut: Date,
): Promise<NamedGuestOverlap[]> {
  const claimed = [...new Set(guestIds.filter(Boolean))];
  if (claimed.length === 0) return [];

  const warnings: NamedGuestOverlap[] = [];
  for (const guestId of claimed) {
    const conflict = await prisma.reservation.findFirst({
      where: {
        status: { in: [...SCHEDULABLE_STATUSES] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        OR: [{ guestId }, { paxGuests: { some: { guestId } } }],
      },
      include: {
        guest: true,
        room: true,
        paxGuests: true,
      },
    });
    if (!conflict) continue;

    const otherClaimed = namedGuestIdsOnStay({
      guestId: conflict.guestId,
      guestFullName: conflict.guest.fullName,
      adults: conflict.adults,
      pax: conflict.paxGuests,
    });
    if (!otherClaimed.includes(guestId)) continue;

    warnings.push({
      guestId,
      reservationId: conflict.id,
      roomNumber: conflict.room?.roomNumber ?? 'TBA',
      checkIn: conflict.checkInDate.toISOString().slice(0, 10),
      checkOut: conflict.checkOutDate.toISOString().slice(0, 10),
    });
  }
  return warnings;
}

/** @deprecated Overlap is a warning, not a block. Kept so callers compile. */
export async function assertNamedGuestsFreeOnStay(reservationId: string) {
  await listNamedGuestOverlaps(reservationId);
}

export async function assertRoomFree(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
  candidate?: {
    shareEligible: boolean;
    shareGender: string | null;
    adults: number;
    isOta?: boolean;
    guestGender?: string | null;
  },
) {
  /** @deprecated Prefer resolveDoorAssignment directly; kept for external callers. */
  await resolveDoorAssignment({
    roomId,
    checkIn,
    checkOut,
    excludeReservationId,
    candidate: candidate ?? {
      shareEligible: false,
      shareGender: null,
      adults: 1,
    },
  });
}

export async function updateReservationSchedule(
  id: string,
  input: {
    checkInDate?: Date;
    checkOutDate?: Date;
    roomId?: string | null;
    allowCompUpgrade?: boolean;
  },
) {
  const reservation = await getReservation(id);
  if (!SCHEDULABLE_STATUSES.includes(reservation.status as (typeof SCHEDULABLE_STATUSES)[number])) {
    throw new Error('Schedule change only for CONFIRMED, IN_HOUSE, or OPTION');
  }

  const newCheckIn = input.checkInDate ?? reservation.checkInDate;
  const newCheckOut = input.checkOutDate ?? reservation.checkOutDate;
  const newRoomId = input.roomId !== undefined ? input.roomId : reservation.roomId;

  if (newCheckOut <= newCheckIn) {
    throw new Error('Check-out must be after check-in');
  }

  if (reservation.status === 'IN_HOUSE') {
    if (input.roomId !== undefined && !input.roomId) {
      throw new Error('Cannot clear the room after check-in');
    }
    if (input.checkInDate && input.checkInDate.getTime() !== reservation.checkInDate.getTime()) {
      throw new Error('Cannot change check-in date while in-house (extend check-out only)');
    }
    if (input.checkOutDate && input.checkOutDate < reservation.checkOutDate) {
      throw new Error('Cannot shorten stay while in-house');
    }
  }

  const nights = countNights(newCheckIn, newCheckOut);
  const totalAmount = toDecimal(decimalToNumber(reservation.ratePlan.pricePerNight) * nights);

  if (newRoomId) {
    const room = await prisma.room.findUnique({ where: { id: newRoomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== reservation.roomTypeId) {
      const { physicalTypeAllowedForDoor } = await import('@/lib/services/door-type.policy');
      const allowed = physicalTypeAllowedForDoor({
        chargedRoomTypeId: reservation.roomTypeId,
        givenRoomTypeId: reservation.givenRoomTypeId,
        doorRoomTypeId: room.roomTypeId,
        compUpgrade: Boolean(input.allowCompUpgrade),
      });
      if (!allowed.ok) throw new Error(allowed.error);
    }
    if (
      BLOCKED_ROOM_STATUSES.includes(room.status as (typeof BLOCKED_ROOM_STATUSES)[number]) ||
      room.inventoryStatus === 'OOO' ||
      room.inventoryStatus === 'OOS'
    ) {
      throw new Error(`Room ${room.roomNumber} is ${room.status} and cannot be assigned`);
    }
    const candidate = {
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
      isOta: await reservationIsOta(id),
      guestGender: reservation.guest.sex,
    };
    const clash = doorClashWindow(reservation.status, newCheckIn, newCheckOut);
    const { shareBedIndex, joiningPool, shareEligible: resolvedShare, shareGender: resolvedGender, autoShare } =
      clash
        ? await assertRoomShareAssignable({
            roomId: newRoomId,
            checkIn: clash.from,
            checkOut: clash.to,
            excludeReservationId: id,
            candidate,
          })
        : {
            shareBedIndex: reservation.shareBedIndex,
            joiningPool: false,
            shareEligible: reservation.shareEligible,
            shareGender: reservation.shareGender,
            autoShare: false,
          };
    const doorOk =
      reservation.status === 'IN_HOUSE'
        ? roomStatusAllowedForShareAssign(room, joiningPool)
        : roomStatusAllowedForBooking(room, joiningPool);
    if (!doorOk) {
      throw new Error(`Room ${room.roomNumber} is ${room.status} and cannot be assigned`);
    }
    if (clash) {
      await assertShareInventory(reservation.roomTypeId, clash.from, clash.to, {
        id,
        shareEligible: autoShare || resolvedShare ? true : reservation.shareEligible,
        shareGender: autoShare ? resolvedGender : reservation.shareGender,
        adults: reservation.adults,
        roomId: newRoomId,
      });
    }
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        roomId: newRoomId,
        shareBedIndex,
        ...(autoShare ? { shareEligible: true, shareGender: resolvedGender } : {}),
        totalAmount,
      },
      include: { room: true, guest: true, ratePlan: true, roomType: true },
    });
    if (reservation.roomId && reservation.roomId !== newRoomId) {
      const { moveStayDoor } = await import('./stay-slice.service');
      await moveStayDoor({
        reservationId: id,
        fromRoomId: reservation.roomId,
        toRoomId: newRoomId,
        status: reservation.status,
        checkIn: newCheckIn,
      });
    }
    if (
      input.checkOutDate &&
      input.checkOutDate.getTime() !== reservation.checkOutDate.getTime()
    ) {
      const { recalcReservationDailyRates } = await import('./reservation-pricing.service');
      await recalcReservationDailyRates(id).catch(() => undefined);
    }
    await alignScheduleSlices(id, reservation, newCheckIn, newCheckOut, newRoomId);
    return updated;
  }

  await assertShareInventory(reservation.roomTypeId, newCheckIn, newCheckOut, {
    id,
    shareEligible: reservation.shareEligible,
    shareGender: reservation.shareGender,
    adults: reservation.adults,
    roomId: newRoomId ?? reservation.roomId,
  });

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      checkInDate: newCheckIn,
      checkOutDate: newCheckOut,
      roomId: newRoomId,
      totalAmount,
    },
    include: { room: true, guest: true, ratePlan: true, roomType: true },
  });
  if (reservation.roomId && reservation.roomId !== newRoomId) {
    const { moveStayDoor } = await import('./stay-slice.service');
    await moveStayDoor({
      reservationId: id,
      fromRoomId: reservation.roomId,
      toRoomId: newRoomId,
      status: reservation.status,
      checkIn: newCheckIn,
    });
  }

  if (
    input.checkOutDate &&
    input.checkOutDate.getTime() !== reservation.checkOutDate.getTime()
  ) {
    const { recalcReservationDailyRates } = await import('./reservation-pricing.service');
    await recalcReservationDailyRates(id).catch(() => undefined);
  }

  await alignScheduleSlices(id, reservation, newCheckIn, newCheckOut, newRoomId);
  return updated;
}

async function alignScheduleSlices(
  id: string,
  reservation: { checkInDate: Date; checkOutDate: Date; roomId: string | null },
  newCheckIn: Date,
  newCheckOut: Date,
  newRoomId: string | null,
) {
  const datesChanged =
    newCheckIn.getTime() !== reservation.checkInDate.getTime() ||
    newCheckOut.getTime() !== reservation.checkOutDate.getTime();
  const roomChanged = newRoomId !== reservation.roomId;
  if (!datesChanged && !roomChanged) return;
  const { alignReservationStaySlices } = await import('./stay-slice.service');
  await alignReservationStaySlices(id);
}

export async function addQuickCharge(
  reservationId: string,
  input: {
    revenueCodeId: string;
    amount: number;
    qty?: number;
    description: string;
    audit?: { userId?: string | null; request?: Request };
  },
) {
  const reservation = await getReservation(reservationId);
  if (reservation.status !== 'IN_HOUSE') {
    throw new Error('Quick charges only for IN_HOUSE reservations');
  }
  const { audit, ...charge } = input;
  return postCharge({ reservationId, ...charge, audit });
}

