/**
 * Realistic Front Office demo dataset: ~28 guests, reservations of every status.
 * Invoked from prisma/seed.ts after master data exists.
 *
 * Nafta seed: `rateMedical` = PKG-STANDART; `mealHB`/`mealBB` args are both Full board (FB)
 * (packages include FB; param names kept for call-site compatibility).
 */
import {
  PaymentMethod,
  PrismaClient,
  ReservationStatus,
  RoomStatus,
  type Agency,
  type BookingSource,
  type Department,
  type Guest,
  type MealPlan,
  type RatePlan,
  type RevenueCode,
  type Room,
  type RoomType,
  type TransferVehicle,
} from '@prisma/client';
import type { ReservationNoteTypeCode } from '../src/lib/reservation-note-types';
import {
  addHotelDays,
  hotelDateKey,
  parseHotelNoon,
  stayCheckIn,
  stayCheckOut,
  stayNights,
  staysOverlap,
} from '../src/lib/hotel-calendar';

export type FoDemoSeedContext = {
  rooms: Room[];
  typeStd: RoomType;
  typeDlx: RoomType;
  typeSuite: RoomType;
  rateStd: RatePlan;
  rateMedical: RatePlan;
  mealHB: MealPlan;
  mealBB: MealPlan;
  agency: Agency;
  sourceWalkin: BookingSource;
  sourceOta: BookingSource;
  revRoom: RevenueCode;
  revFood: RevenueCode;
  deptAcc: Department;
  deptRest: Department;
  vehicleVan1: TransferVehicle;
};

const GUEST_PROFILES: Array<{
  fullName: string;
  firstName: string;
  lastName: string;
  nationality: string;
  phone: string;
  email: string;
  passport: string;
  fin?: string;
  voen?: string;
  vip?: string;
  greyList?: boolean;
  visitCount?: number;
}> = [
  { fullName: 'Əliyev Rəşad Kamal', firstName: 'Rəşad', lastName: 'Əliyev', nationality: 'AZ', phone: '+994501112233', email: 'rashad.aliyev@mail.az', passport: 'AA1234567', fin: '5ZKX8K1', vip: 'GOLD', visitCount: 4 },
  { fullName: 'Həsənova Günel Fidan', firstName: 'Günel', lastName: 'Həsənova', nationality: 'AZ', phone: '+994502223344', email: 'gunel.hasanova@gmail.com', passport: 'AA2345678', visitCount: 2 },
  { fullName: 'Məmmədov Tural Elşən', firstName: 'Tural', lastName: 'Məmmədov', nationality: 'AZ', phone: '+994503334455', email: 'tural.m@outlook.com', passport: 'AA3456789', fin: '7H2P9M4', visitCount: 1 },
  { fullName: 'Kərimova Leyla', firstName: 'Leyla', lastName: 'Kərimova', nationality: 'AZ', phone: '+994504445566', email: 'leyla.k@mail.ru', passport: 'AA4567890', visitCount: 6 },
  { fullName: 'İbrahimov Vüsal', firstName: 'Vüsal', lastName: 'İbrahimov', nationality: 'AZ', phone: '+994505556677', email: 'vusal.i@yahoo.com', passport: 'AA5678901', visitCount: 3 },
  { fullName: 'Quliyeva Nərgiz', firstName: 'Nərgiz', lastName: 'Quliyeva', nationality: 'AZ', phone: '+994506667788', email: 'nergiz.q@gmail.com', passport: 'AA6789012', greyList: true, visitCount: 1 },
  { fullName: 'Rəhimov Elçin', firstName: 'Elçin', lastName: 'Rəhimov', nationality: 'AZ', phone: '+994507778899', email: 'elcin.r@mail.az', passport: 'AA7890123', visitCount: 2 },
  { fullName: 'Səfərova Könül', firstName: 'Könül', lastName: 'Səfərova', nationality: 'AZ', phone: '+994508889900', email: 'konul.s@inbox.ru', passport: 'AA8901234', visitCount: 5 },
  { fullName: 'Hüseynov Orxan', firstName: 'Orxan', lastName: 'Hüseynov', nationality: 'AZ', phone: '+994509990011', email: 'orxan.h@gmail.com', passport: 'AA9012345', vip: 'SILVER', visitCount: 2 },
  { fullName: 'Babayeva Aysel', firstName: 'Aysel', lastName: 'Babayeva', nationality: 'AZ', phone: '+994551001122', email: 'aysel.b@mail.az', passport: 'AB0123456', visitCount: 1 },
  { fullName: 'Mustafayev Kamran', firstName: 'Kamran', lastName: 'Mustafayev', nationality: 'AZ', phone: '+994552223344', email: 'kamran.m@corp.az', passport: 'AB1234567', visitCount: 7 },
  { fullName: 'Zeynalova Fidan', firstName: 'Fidan', lastName: 'Zeynalova', nationality: 'AZ', phone: '+994553334455', email: 'fidan.z@gmail.com', passport: 'AB2345678', visitCount: 2 },
  { fullName: 'Vladimir Petrov', firstName: 'Vladimir', lastName: 'Petrov', nationality: 'RU', phone: '+79031234567', email: 'v.petrov@yandex.ru', passport: '72 1234567', visitCount: 3 },
  { fullName: 'Elena Sokolova', firstName: 'Elena', lastName: 'Sokolova', nationality: 'RU', phone: '+79037654321', email: 'elena.sokolova@gmail.com', passport: '72 7654321', visitCount: 1 },
  { fullName: 'Dmitry Volkov', firstName: 'Dmitry', lastName: 'Volkov', nationality: 'RU', phone: '+79059876543', email: 'd.volkov@mail.ru', passport: '72 9876543', visitCount: 2 },
  { fullName: 'Anna Kowalska', firstName: 'Anna', lastName: 'Kowalska', nationality: 'PL', phone: '+48501234567', email: 'anna.k@wp.pl', passport: 'ED1234567', visitCount: 1 },
  { fullName: 'Hans Mueller', firstName: 'Hans', lastName: 'Mueller', nationality: 'DE', phone: '+491701234567', email: 'h.mueller@gmx.de', passport: 'C01X00T47', visitCount: 2 },
  { fullName: 'Sophie Martin', firstName: 'Sophie', lastName: 'Martin', nationality: 'FR', phone: '+33612345678', email: 'sophie.martin@gmail.com', passport: '15AB12345', visitCount: 1 },
  { fullName: 'James Wilson', firstName: 'James', lastName: 'Wilson', nationality: 'GB', phone: '+447700900123', email: 'j.wilson@outlook.com', passport: '533123456', visitCount: 1 },
  { fullName: 'Fatima Al Mansouri', firstName: 'Fatima', lastName: 'Al Mansouri', nationality: 'AE', phone: '+971501234567', email: 'fatima.am@emirates.ae', passport: 'N1234567', vip: 'PLATINUM', visitCount: 4 },
  { fullName: 'Omar Hassan', firstName: 'Omar', lastName: 'Hassan', nationality: 'TR', phone: '+905321234567', email: 'omar.h@gmail.com', passport: 'U12345678', visitCount: 2 },
  { fullName: 'Leyla Karimova (child)', firstName: 'Leyla', lastName: 'Karimova', nationality: 'AZ', phone: '+994504445566', email: 'leyla.child@mail.az', passport: 'AA4567891', visitCount: 0 },
  { fullName: 'Nafta Petroleum HR', firstName: 'Nafta', lastName: 'HR', nationality: 'AZ', phone: '+994125551100', email: 'hr@nafta.az', passport: 'CORP-HR-01', voen: '1234567891' },
  { fullName: 'SOCAR Wellness Group', firstName: 'SOCAR', lastName: 'Wellness', nationality: 'AZ', phone: '+994125552200', email: 'wellness@socar.az', passport: 'CORP-SOCAR', voen: '9876543210' },
  { fullName: 'Turizm Agentliyi MMC', firstName: 'Turizm', lastName: 'MMC', nationality: 'AZ', phone: '+994125553300', email: 'ops@travel-az.az', passport: 'CORP-TRAVEL', voen: '1122334455' },
  { fullName: 'Gurbanov Nurlan', firstName: 'Nurlan', lastName: 'Gurbanov', nationality: 'AZ', phone: '+994554445566', email: 'nurlan.g@mail.az', passport: 'AB3456789', visitCount: 1 },
  { fullName: 'Rustamov Emin', firstName: 'Emin', lastName: 'Rustamov', nationality: 'AZ', phone: '+994555556677', email: 'emin.r@gmail.com', passport: 'AB4567890', visitCount: 3 },
  { fullName: 'Shirinova Aynur', firstName: 'Aynur', lastName: 'Shirinova', nationality: 'AZ', phone: '+994556667788', email: 'aynur.s@inbox.ru', passport: 'AB5678901', visitCount: 2 },
];

/** Statuses that block the room on the room plan (must not overlap per room). */
const ROOM_PLAN_STATUSES: ReservationStatus[] = ['CONFIRMED', 'IN_HOUSE', 'OPTION'];

function dateOnlyKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export async function seedFoDemo(prisma: PrismaClient, ctx: FoDemoSeedContext): Promise<void> {
  const todayKey = hotelDateKey();
  const todayDate = dateOnlyKey(todayKey);
  const yesterdayKey = addHotelDays(todayKey, -1);
  const yesterdayDate = dateOnlyKey(yesterdayKey);
  /** Stay check-in at offset days from today (14:00 Asia/Baku). */
  const ci = (days: number) => stayCheckIn(addHotelDays(todayKey, days));
  /** Stay check-out at offset days from today (12:00 Asia/Baku). */
  const co = (days: number) => stayCheckOut(addHotelDays(todayKey, days));
  /** Non-stay timestamp at hotel noon for offset day. */
  const at = (days: number) => parseHotelNoon(addHotelDays(todayKey, days));

  await prisma.businessDay.upsert({
    where: { date: yesterdayDate },
    create: { date: yesterdayDate, status: 'CLOSED' },
    update: { status: 'CLOSED' },
  });
  await prisma.businessDay.upsert({
    where: { date: todayDate },
    create: { date: todayDate, status: 'OPEN' },
    update: { status: 'OPEN' },
  });

  const yesterdayBd = await prisma.businessDay.findUnique({
    where: { date: yesterdayDate },
  });
  if (yesterdayBd && !(await prisma.nightAuditRun.findFirst({ where: { businessDayId: yesterdayBd.id } }))) {
    await prisma.nightAuditRun.create({
      data: {
        businessDayId: yesterdayBd.id,
        status: 'COMPLETED',
        stepsJson: JSON.stringify(['room_charges', 'housekeeping', 'statistics']),
        completedAt: at(-1),
      },
    });
  }

  if (!(await prisma.cashShift.findFirst({ where: { closedAt: null } }))) {
    await prisma.cashShift.create({
      data: {
        cashier: 'reception',
        registerId: 'FO-01',
        status: 'OPEN',
        openedAt: at(-1),
      },
    });
  }

  const extraRooms = await Promise.all(
    ['103', '104', '203', '204', '303', '304', '403', '404'].map((num, i) => {
      const typeId = num.startsWith('3')
        ? ctx.typeSuite.id
        : num.startsWith('2') || num === '403'
          ? ctx.typeDlx.id
          : ctx.typeStd.id;
      const floor = parseInt(num[0], 10);
      return prisma.room.upsert({
        where: { roomNumber: num },
        create: { roomNumber: num, roomTypeId: typeId, floor, status: RoomStatus.AVAILABLE },
        update: {},
      });
    }),
  );

  const allRooms = [...ctx.rooms, ...extraRooms.filter((r) => !ctx.rooms.some((x) => x.id === r.id))];
  const roomByNum = Object.fromEntries(allRooms.map((r) => [r.roomNumber, r]));

  const guests: Guest[] = [];
  for (const p of GUEST_PROFILES) {
    const g = await prisma.guest.create({
      data: {
        fullName: p.fullName,
        firstName: p.firstName,
        lastName: p.lastName,
        nationality: p.nationality,
        phone: p.phone,
        email: p.email,
        voen: p.voen ?? null,
        vipType: p.vip ?? null,
        greyList: p.greyList ?? false,
        visitCount: p.visitCount ?? 0,
        gdprConfirmed: true,
        smsConsent: true,
        hotelName: 'Nafta Sanatorium',
      },
    });
    guests.push(g);
    await prisma.guestDocument.create({
      data: {
        guestId: g.id,
        docType: p.nationality === 'AZ' ? 'ID_CARD' : 'PASSPORT',
        docNumber: p.passport,
        expiresAt: at(365 * 3),
      },
    });
    await prisma.guestContact.createMany({
      data: [
        { guestId: g.id, kind: 'MOBILE', value: p.phone, isPrimary: true },
        { guestId: g.id, kind: 'EMAIL', value: p.email, isPrimary: true },
      ],
    });
  }

  let resSeq = 100;
  const roomPlanSlots: Record<
    string,
    Array<{ guest: string; checkIn: Date; checkOut: Date; status: ReservationStatus }>
  > = {};

  async function createReservation(spec: {
    guestIndex: number;
    roomNumber?: string;
    roomTypeId?: string;
    ratePlanId?: string;
    checkIn: Date;
    checkOut: Date;
    status: ReservationStatus;
    payment?: PaymentMethod;
    agencyId?: string;
    groupId?: string;
    sourceId?: string;
    notes?: Partial<Record<ReservationNoteTypeCode, string>>;
    total?: number;
    withStay?: boolean;
    withFolio?: boolean;
    chargeAmount?: number;
    payAmount?: number;
  }) {
    const guest = guests[spec.guestIndex]!;
    if (spec.roomNumber && ROOM_PLAN_STATUSES.includes(spec.status)) {
      const slots = roomPlanSlots[spec.roomNumber] ?? [];
      for (const s of slots) {
        if (staysOverlap(s.checkIn, s.checkOut, spec.checkIn, spec.checkOut)) {
          throw new Error(
            `[seed-fo-demo] Room ${spec.roomNumber} overlap: ${s.guest} (${s.status}) ` +
              `${hotelDateKey(s.checkIn)}–${hotelDateKey(s.checkOut)} vs ${guest.fullName} ` +
              `(${spec.status}) ${hotelDateKey(spec.checkIn)}–${hotelDateKey(spec.checkOut)}`,
          );
        }
      }
      slots.push({
        guest: guest.fullName,
        checkIn: spec.checkIn,
        checkOut: spec.checkOut,
        status: spec.status,
      });
      roomPlanSlots[spec.roomNumber] = slots;
    }
    const room = spec.roomNumber ? roomByNum[spec.roomNumber] : undefined;
    const nights = stayNights(spec.checkIn, spec.checkOut);
    const rate = spec.ratePlanId ?? ctx.rateStd.id;
    const rt = spec.roomTypeId ?? room?.roomTypeId ?? ctx.typeStd.id;
    resSeq += 1;
    const res = await prisma.reservation.create({
      data: {
        guestId: guest.id,
        roomTypeId: rt,
        roomId: room?.id ?? null,
        ratePlanId: rate,
        mealPlanId: rate === ctx.rateMedical.id ? ctx.mealHB.id : ctx.mealBB.id,
        agencyId: spec.agencyId ?? null,
        groupId: spec.groupId ?? null,
        sourceId: spec.sourceId ?? ctx.sourceWalkin.id,
        checkInDate: spec.checkIn,
        checkOutDate: spec.checkOut,
        status: spec.status,
        paymentMethod: spec.payment ?? PaymentMethod.CARD,
        totalAmount: spec.total ?? nights * 120,
        voucherNo: `VCH-2026-${resSeq}`,
        resNo: `NAFT-2026-${String(resSeq).padStart(4, '0')}`,
        adults: 1,
        market: spec.agencyId ? 'B2B' : 'FIT',
        segment: spec.status === 'IN_HOUSE' ? 'SANATORIUM' : 'LEISURE',
        booker: guest.fullName,
      },
    });

    if (spec.notes) {
      for (const [noteType, text] of Object.entries(spec.notes)) {
        if (!text?.trim()) continue;
        await prisma.reservationNote.create({
          data: {
            reservationId: res.id,
            noteType: noteType as ReservationNoteTypeCode,
            text,
          },
        });
      }
    }

    const paxName = guest.fullName.split(' ');
    await prisma.reservationGuest.create({
      data: {
        reservationId: res.id,
        firstName: guest.firstName ?? paxName[0] ?? 'Guest',
        lastName: guest.lastName ?? paxName.slice(1).join(' ') ?? '—',
        nationality: guest.nationality,
        passportNo: GUEST_PROFILES[spec.guestIndex]?.passport ?? 'N/A',
        isPrimary: true,
      },
    });

    for (let i = 0; i < nights; i++) {
      await prisma.reservationDailyRate.create({
        data: {
          reservationId: res.id,
          stayDate: dateOnlyKey(addHotelDays(hotelDateKey(spec.checkIn), i)),
          amount: rate === ctx.rateMedical.id ? 180 : 120,
        },
      });
    }

    if (room && (spec.status === 'IN_HOUSE' || spec.status === 'CONFIRMED')) {
      const occ = spec.status === 'IN_HOUSE';
      await prisma.room.update({
        where: { id: room.id },
        data: { status: occ ? RoomStatus.OCCUPIED : RoomStatus.CLEAN },
      });
    }

    if (spec.withStay && spec.status === 'IN_HOUSE') {
      await prisma.stay.create({
        data: {
          reservationId: res.id,
          actualCheckIn: spec.checkIn,
        },
      });
    }

    if (spec.withFolio) {
      const folio = await prisma.folio.create({
        data: { reservationId: res.id, type: 'GUEST', status: 'OPEN' },
      });
      if (spec.chargeAmount) {
        await prisma.folioCharge.create({
          data: {
            folioId: folio.id,
            revenueCodeId: ctx.revRoom.id,
            departmentId: ctx.deptAcc.id,
            amount: spec.chargeAmount,
            qty: 1,
            description: 'Room accommodation',
            businessDate: todayDate,
          },
        });
      }
      if (spec.payAmount) {
        await prisma.folioPayment.create({
          data: {
            folioId: folio.id,
            amount: spec.payAmount,
            paymentMethod: spec.payment ?? PaymentMethod.CARD,
          },
        });
      }
    }

    return res;
  }

  const group = await prisma.reservationGroup.create({
    data: {
      code: 'GRP-NAFTA-MAY26',
      name: 'SOCAR Wellness — May group',
      agencyId: ctx.agency.id,
    },
  });

  const inHouseSpecs: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 0, roomNumber: '201', ratePlanId: ctx.rateMedical.id, checkIn: ci(-2), checkOut: co(4), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 540, payAmount: 200, notes: { RES_NOTE: 'Müalicə paketi — gündəlik prosedur cədvəli verilib.', CIN_NOTE: 'Giriş saat 14:30, VIP lounge.' } },
    { guestIndex: 1, roomNumber: '101', checkIn: ci(-1), checkOut: co(2), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 360, notes: { GENERAL_NOTE: 'Vegetarian breakfast.' } },
    { guestIndex: 12, roomNumber: '301', ratePlanId: ctx.rateMedical.id, checkIn: ci(-3), checkOut: co(7), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 720, payAmount: 400 },
    { guestIndex: 13, roomNumber: '302', checkIn: ci(-1), checkOut: co(5), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 480 },
    { guestIndex: 18, roomNumber: '202', checkIn: ci(-2), checkOut: co(3), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 600, payAmount: 600 },
    { guestIndex: 4, roomNumber: '102', checkIn: ci(0), checkOut: co(3), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 360 },
    { guestIndex: 8, roomNumber: '103', checkIn: ci(-1), checkOut: co(6), status: 'IN_HOUSE', withStay: true, notes: { ROOM_NOTE: 'Extra pillows.' } },
    { guestIndex: 24, roomNumber: '204', checkIn: ci(-4), checkOut: co(2), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 500, notes: { PAYMENT_NOTE: 'Partial payment on checkout.' } },
  ];

  for (const s of inHouseSpecs) {
    await createReservation(s);
  }

  const arrivalsToday: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 2, roomNumber: '104', checkIn: ci(0), checkOut: co(3), status: 'CONFIRMED', sourceId: ctx.sourceOta.id },
    { guestIndex: 3, roomNumber: '204', checkIn: ci(3), checkOut: co(8), status: 'CONFIRMED', agencyId: ctx.agency.id, notes: { RES_NOTE: 'Arrival after in-house on 204 ends (+2).' } },
    { guestIndex: 11, roomNumber: '303', checkIn: ci(0), checkOut: co(4), status: 'CONFIRMED', notes: { EXTRA_REQ: 'Late check-in 22:00.' } },
  ];
  for (const s of arrivalsToday) await createReservation(s);

  const departuresToday: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 10, roomNumber: '203', checkIn: ci(-4), checkOut: co(0), status: 'IN_HOUSE', withStay: true, notes: { RES_NOTE: 'Departure today — chain on 203 starts tomorrow.' } },
    { guestIndex: 7, roomNumber: '401', checkIn: ci(-2), checkOut: co(0), status: 'IN_HOUSE', withStay: true, withFolio: true, chargeAmount: 240, payAmount: 240 },
  ];
  for (const s of departuresToday) await createReservation(s);

  const optionSpecs: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 5, roomNumber: '304', checkIn: ci(2), checkOut: co(6), status: 'OPTION', notes: { RES_NOTE: 'Option until Friday 18:00.' } },
    { guestIndex: 9, checkIn: ci(3), checkOut: co(7), status: 'OPTION' },
    { guestIndex: 15, roomNumber: '402', checkIn: ci(1), checkOut: co(4), status: 'OPTION' },
  ];
  for (const s of optionSpecs) await createReservation(s);

  const cancelled: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 6, checkIn: ci(1), checkOut: co(4), status: 'CANCELLED', notes: { CANCEL_NOTE: 'Guest cancelled — flight delayed.' } },
    { guestIndex: 14, checkIn: ci(2), checkOut: co(5), status: 'CANCELLED', notes: { CANCEL_NOTE: 'OTA cancellation ref OTA-9912.' } },
  ];
  for (const s of cancelled) await createReservation(s);

  await createReservation({
    guestIndex: 16,
    roomNumber: '402',
    checkIn: ci(-1),
    checkOut: co(2),
    status: 'NO_SHOW',
    notes: { CANCEL_NOTE: 'No-show — no contact.' },
  });

  const checkedOut: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 17, roomNumber: '202', checkIn: ci(-5), checkOut: co(-1), status: 'CHECKED_OUT', withFolio: true, chargeAmount: 600, payAmount: 600 },
    { guestIndex: 19, roomNumber: '103', checkIn: ci(-3), checkOut: co(-1), status: 'CHECKED_OUT' },
    { guestIndex: 20, roomNumber: '104', checkIn: ci(-7), checkOut: co(-2), status: 'CHECKED_OUT', agencyId: ctx.agency.id },
  ];
  for (const s of checkedOut) {
    const res = await createReservation(s);
    await prisma.stay.create({
      data: {
        reservationId: res.id,
        actualCheckIn: s.checkIn,
        actualCheckOut: s.checkOut,
      },
    });
  }

  const futureConfirmed: Parameters<typeof createReservation>[0][] = [
    { guestIndex: 21, roomNumber: '301', checkIn: ci(8), checkOut: co(13), status: 'CONFIRMED', notes: { RES_NOTE: 'After in-house on 301 ends (+7).' } },
    { guestIndex: 22, roomNumber: '302', checkIn: ci(7), checkOut: co(14), status: 'CONFIRMED', sourceId: ctx.sourceOta.id },
    { guestIndex: 23, checkIn: ci(4), checkOut: co(8), status: 'CONFIRMED' },
    { guestIndex: 24, checkIn: ci(10), checkOut: co(15), status: 'CONFIRMED', agencyId: ctx.agency.id },
    { guestIndex: 25, roomNumber: '403', checkIn: ci(3), checkOut: co(6), status: 'CONFIRMED' },
  ];
  for (const s of futureConfirmed) await createReservation(s);

  const groupMembers = [
    { guestIndex: 26, roomNumber: '303' },
    { guestIndex: 27, roomNumber: '304' },
    { guestIndex: 21, roomNumber: '401' },
    { guestIndex: 22, roomNumber: '404' },
  ];
  for (const m of groupMembers) {
    await createReservation({
      guestIndex: m.guestIndex,
      roomNumber: m.roomNumber,
      checkIn: ci(8),
      checkOut: co(12),
      status: 'CONFIRMED',
      agencyId: ctx.agency.id,
      groupId: group.id,
      payment: PaymentMethod.COMPANY_ACCOUNT,
      notes: { RES_NOTE: 'Group SOCAR — single invoice.' },
    });
  }

  await createReservation({
    guestIndex: 3,
    checkIn: ci(0),
    checkOut: co(2),
    status: 'CONFIRMED',
    notes: { RES_NOTE: 'Unassigned — assign before 16:00.' },
  });
  await createReservation({
    guestIndex: 11,
    checkIn: ci(1),
    checkOut: co(4),
    status: 'CONFIRMED',
  });

  /** Room 203: turnover chain — back-to-back, next day, 1-night gap (for room plan / rack). */
  const room203Chain: Parameters<typeof createReservation>[0][] = [
    {
      guestIndex: 14,
      roomNumber: '203',
      checkIn: ci(1),
      checkOut: co(4),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '203 chain 1/6 — starts day after today.' },
    },
    {
      guestIndex: 15,
      roomNumber: '203',
      checkIn: ci(4),
      checkOut: co(6),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '203 chain 2/6 — checkout = next check-in (same day turnover).' },
    },
    {
      guestIndex: 16,
      roomNumber: '203',
      checkIn: ci(6),
      checkOut: co(8),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '203 chain 3/6 — back-to-back, 2 nights.' },
    },
    {
      guestIndex: 17,
      roomNumber: '203',
      checkIn: ci(9),
      checkOut: co(11),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '203 chain 4/6 — 1 empty night between stays (gap day).' },
    },
    {
      guestIndex: 19,
      roomNumber: '203',
      checkIn: ci(11),
      checkOut: co(14),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '203 chain 5/6 — arrival next day after previous checkout.' },
    },
    {
      guestIndex: 20,
      roomNumber: '203',
      checkIn: ci(15),
      checkOut: co(17),
      status: 'OPTION',
      notes: { RES_NOTE: '203 chain 6/6 — option; 1-night gap before arrival.' },
    },
  ];
  for (const s of room203Chain) await createReservation(s);

  /** Room 403: second chain — mixed gaps (after guest 25 stay ends +6). */
  const room403Chain: Parameters<typeof createReservation>[0][] = [
    {
      guestIndex: 21,
      roomNumber: '403',
      checkIn: ci(7),
      checkOut: co(9),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '403 chain 1/5 — first slot after existing booking.' },
    },
    {
      guestIndex: 22,
      roomNumber: '403',
      checkIn: ci(9),
      checkOut: co(11),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '403 chain 2/5 — turnover same day.' },
    },
    {
      guestIndex: 23,
      roomNumber: '403',
      checkIn: ci(12),
      checkOut: co(14),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '403 chain 3/5 — check-in next calendar day after prior checkout.' },
    },
    {
      guestIndex: 25,
      roomNumber: '403',
      checkIn: ci(14),
      checkOut: co(16),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '403 chain 4/5 — back-to-back turnover.' },
    },
    {
      guestIndex: 26,
      roomNumber: '403',
      checkIn: ci(18),
      checkOut: co(21),
      status: 'CONFIRMED',
      notes: { RES_NOTE: '403 chain 5/5 — 2-night gap, then 3-night stay.' },
    },
  ];
  for (const s of room403Chain) await createReservation(s);

  await prisma.room.update({
    where: { id: roomByNum['401']!.id },
    data: { status: RoomStatus.OOO },
  });
  await prisma.room.update({
    where: { id: roomByNum['402']!.id },
    data: { status: RoomStatus.DIRTY },
  });
  await prisma.room.update({
    where: { id: roomByNum['404']!.id },
    data: { status: RoomStatus.INSPECTED },
  });

  const hkRoom = roomByNum['104'];
  if (hkRoom) {
    await prisma.housekeepingTask.create({
      data: { roomId: hkRoom.id, status: 'PENDING', notes: 'Checkout clean — 104' },
    });
  }

  const medRes = await prisma.reservation.findFirst({
    where: { guestId: guests[0]!.id, status: 'IN_HOUSE' },
  });
  if (medRes) {
    const tomorrowKey = addHotelDays(todayKey, 1);
    const tomorrow = new Date(`${tomorrowKey}T10:00:00.000+04:00`);
    await prisma.procedureAppointment.create({
      data: {
        reservationId: medRes.id,
        serviceId: (await prisma.procedureService.findFirst({ where: { code: 'MASSAGE' } }))!.id,
        staffName: 'Dr. Hasanova',
        placeCode: 'SPA-1',
        startAt: tomorrow,
        endAt: new Date(tomorrow.getTime() + 45 * 60000),
        status: 'BOOKED',
      },
    });
    await prisma.transferOrder.create({
      data: {
        reservationId: medRes.id,
        direction: 'OUT',
        flightNo: 'J2-813',
        pickupAt: at(4),
        vehicleId: ctx.vehicleVan1.id,
        status: 'CONFIRMED',
        price: 40,
        notes: 'GYD airport departure',
      },
    });
  }

  await prisma.channelSyncError.create({
    data: {
      otaReference: 'BKNG-88421',
      errorMessage: 'Rate mismatch on DLX — manual review',
      status: 'OPEN',
    },
  });

  await prisma.lostFoundItem.create({
    data: {
      description: 'Silver wristwatch — lobby sofa',
      location: 'Main lobby',
      foundDate: yesterdayDate,
      status: 'OPEN',
    },
  });

  console.log('[seed-fo-demo] guests:', guests.length, 'reservations seeded, rooms:', allRooms.length);
}
