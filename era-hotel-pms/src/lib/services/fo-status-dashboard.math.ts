/**
 * Front-office status dashboard (ElektraWeb hotel dashboard / Status).
 * Pure aggregation so the screen can be tested without a database.
 *
 * Type matrix codes match the Elektra widget. ERA fills NR, DU (same-day stay),
 * SHR (share), WO (walk-in profile), NS (no-show) and OT (option). VR, IU and BO
 * have no source in this model and stay zero.
 */

export type StayStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type DashStay = {
  id: string;
  status: StayStatus;
  roomId: string | null;
  roomNumber: string | null;
  roomCount: number;
  inYmd: string;
  outYmd: string;
  createdYmd: string;
  updatedYmd: string;
  nights: number;
  adults: number;
  child1: number;
  child2: number;
  baby: number;
  share: boolean;
  walkIn: boolean;
  group: boolean;
  accomType: string | null;
  mealCode: string | null;
  roomTypeCode: string;
  roomTypeName: string;
  guestId: string;
  guestName: string;
  guestVisits: number;
  paymentMethod: string;
  totalAmount: number;
};

export type RoomSlice = {
  hk: 'DIRTY' | 'PICKUP' | 'CLEAN' | 'INSPECTED';
  inventory: 'IN_SERVICE' | 'OOS' | 'OOO';
  status: string;
  roomTypeCode: string;
};

export type ChargeSlice = {
  kind: 'room' | 'food' | 'beverage' | 'other';
  gross: number;
  vatRate: number;
};

export type NightRate = {
  day: string;
  reservationId: string;
  amount: number;
};

export type FoStatusInput = {
  day: string;
  monthStart: string;
  mtdDays: number;
  forecastDays: string[];
  capacity: number;
  bedCapacity: number | null;
  includeWaiting: boolean;
  withRevenue: boolean;
  stays: DashStay[];
  rooms: RoomSlice[];
  roomTypeQuota: { code: string; name: string; quota: number }[];
  charges: ChargeSlice[];
  nightRates: NightRate[];
};

export type TypeMatrix = {
  rooms: number;
  pax: number;
  persons: number;
  adults: number;
  child1: number;
  child2: number;
  baby: number;
  nr: number;
  du: number;
  shr: number;
  wo: number;
  ns: number;
  ot: number;
  vr: number;
  iu: number;
  bo: number;
};

export type StatusListRow = {
  id: string;
  guestName: string;
  roomNumber: string | null;
  roomType: string;
  meal: string | null;
  inYmd: string;
  outYmd: string;
  adults: number;
  child1: number;
  child2: number;
  baby: number;
  status: string;
};

export type FlowCard = {
  resCount: number;
  roomNights: number;
  paxNights: number;
  roomPercent: number | null;
  bedPercent: number | null;
  adr: number | null;
  revenue: number;
};

export type ForecastPoint = {
  day: string;
  occupied: number;
  available: number;
  blocks: number;
  closed: number;
  arriving: number;
  departing: number;
  individual: number;
  group: number;
  revenue: number;
  adults: number;
  child1: number;
  child2: number;
  baby: number;
  sold: number;
  complimentary: number;
  houseUse: number;
};

export type FoStatusSnapshot = {
  day: string;
  capacity: number;
  bedCapacity: number | null;
  inHouse: TypeMatrix;
  expectedArrivals: TypeMatrix;
  expectedDepartures: TypeMatrix;
  endOfDay: TypeMatrix;
  movement: { key: string; rooms: number; pax: number; percent: number | null }[];
  clean: Record<'clean' | 'closed' | 'confirmed' | 'dirty' | 'maintenance' | 'reserved' | 'touched', number>;
  occupancyPie: { occupied: number; available: number; blocks: number; dayUse: number };
  forecast: ForecastPoint[];
  sales: FlowCard;
  cancellations: FlowCard;
  occupancy: FlowCard;
  revenues: {
    room: number;
    food: number;
    beverage: number;
    other: number;
    roomNet: number;
    netAdr: number | null;
    total: number;
  };
  roomTypes: { code: string; name: string; sold: number; quota: number; available: number }[];
  board: { code: string; rooms: number }[];
  ages: { adults: number; child1: number; child2: number; baby: number };
  repeatGuests: number;
  todayReservations: StatusListRow[];
  folioTypes: { method: string; count: number }[];
  lists: {
    expectedArrivals: StatusListRow[];
    expectedDepartures: StatusListRow[];
    realizedArrivals: StatusListRow[];
    realizedDepartures: StatusListRow[];
  };
};

const EMPTY_MATRIX = (): TypeMatrix => ({
  rooms: 0,
  pax: 0,
  persons: 0,
  adults: 0,
  child1: 0,
  child2: 0,
  baby: 0,
  nr: 0,
  du: 0,
  shr: 0,
  wo: 0,
  ns: 0,
  ot: 0,
  vr: 0,
  iu: 0,
  bo: 0,
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(numerator: number, denominator: number): number | null {
  if (!(denominator > 0)) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function paxOf(s: DashStay): number {
  return s.adults + s.child1 + s.child2 + s.baby;
}

export function stayBucket(s: DashStay): 'NS' | 'OT' | 'DU' | 'SHR' | 'WO' | 'NR' {
  if (s.status === 'NO_SHOW') return 'NS';
  if (s.status === 'OPTION') return 'OT';
  if (s.inYmd === s.outYmd) return 'DU';
  if (s.share) return 'SHR';
  if (s.walkIn) return 'WO';
  return 'NR';
}

const BUCKET_RANK: Record<string, number> = { NS: 6, OT: 5, DU: 4, SHR: 3, WO: 2, NR: 1 };

function accomKind(value: string | null): 'COMP' | 'HOUSE' | null {
  const v = (value ?? '').trim().toUpperCase();
  if (v.startsWith('COMP')) return 'COMP';
  if (v.startsWith('HOUSE') || v === 'HU') return 'HOUSE';
  return null;
}

function sells(status: StayStatus, includeWaiting: boolean): boolean {
  if (status === 'CONFIRMED' || status === 'IN_HOUSE' || status === 'CHECKED_OUT') return true;
  return includeWaiting && status === 'OPTION';
}

function coversNight(s: DashStay, day: string): boolean {
  return s.inYmd <= day && s.outYmd > day;
}

function matrixOf(stays: DashStay[]): TypeMatrix {
  const m = EMPTY_MATRIX();
  const groups = new Map<string, DashStay[]>();
  for (const s of stays) {
    const key = s.roomId ?? `stay:${s.id}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
    m.adults += s.adults;
    m.child1 += s.child1;
    m.child2 += s.child2;
    m.baby += s.baby;
    m.pax += paxOf(s);
  }
  m.persons = m.pax;
  for (const [key, list] of groups) {
    const rooms = key.startsWith('stay:') ? Math.max(1, list[0].roomCount) : 1;
    let bucket: ReturnType<typeof stayBucket> = 'NR';
    for (const s of list) {
      const b = stayBucket(s);
      if (BUCKET_RANK[b] > BUCKET_RANK[bucket]) bucket = b;
    }
    m.rooms += rooms;
    if (bucket === 'NR') m.nr += rooms;
    else if (bucket === 'DU') m.du += rooms;
    else if (bucket === 'SHR') m.shr += rooms;
    else if (bucket === 'WO') m.wo += rooms;
    else if (bucket === 'NS') m.ns += rooms;
    else m.ot += rooms;
  }
  return m;
}

function toRow(s: DashStay): StatusListRow {
  return {
    id: s.id,
    guestName: s.guestName,
    roomNumber: s.roomNumber,
    roomType: s.roomTypeCode,
    meal: s.mealCode,
    inYmd: s.inYmd,
    outYmd: s.outYmd,
    adults: s.adults,
    child1: s.child1,
    child2: s.child2,
    baby: s.baby,
    status: s.status,
  };
}

function flowCard(stays: DashStay[], capacity: number, bedCapacity: number | null, days: number): FlowCard {
  let roomNights = 0;
  let paxNights = 0;
  let revenue = 0;
  for (const s of stays) {
    const nights = Math.max(0, s.nights);
    const rooms = s.roomId ? 1 : Math.max(1, s.roomCount);
    roomNights += rooms * nights;
    paxNights += paxOf(s) * nights;
    revenue += s.totalAmount;
  }
  const roomDenom = capacity * days;
  const bedDenom = bedCapacity == null ? null : bedCapacity * days;
  return {
    resCount: stays.length,
    roomNights,
    paxNights,
    roomPercent: pct(roomNights, roomDenom),
    bedPercent: bedDenom == null ? null : pct(paxNights, bedDenom),
    adr: roomNights > 0 ? round2(revenue / roomNights) : null,
    revenue: round2(revenue),
  };
}

function nightStays(stays: DashStay[], day: string, includeWaiting: boolean): DashStay[] {
  return stays.filter((s) => sells(s.status, includeWaiting) && coversNight(s, day));
}

export function buildFoStatus(input: FoStatusInput): FoStatusSnapshot {
  const { day, includeWaiting } = input;
  const ooo = input.rooms.filter((r) => r.inventory === 'OOO').length;

  const inHouseStays = input.stays.filter((s) => s.status === 'IN_HOUSE');
  const expectedArrivals = input.stays.filter(
    (s) => s.inYmd === day && (s.status === 'CONFIRMED' || (includeWaiting && s.status === 'OPTION')),
  );
  const expectedDepartures = input.stays.filter((s) => s.status === 'IN_HOUSE' && s.outYmd === day);
  const realizedArrivals = input.stays.filter(
    (s) => s.inYmd === day && (s.status === 'IN_HOUSE' || s.status === 'CHECKED_OUT'),
  );
  const realizedDepartures = input.stays.filter((s) => s.status === 'CHECKED_OUT' && s.outYmd === day);
  const startStays = input.stays.filter(
    (s) =>
      (s.status === 'IN_HOUSE' && s.inYmd < day) ||
      (s.status === 'CHECKED_OUT' && s.outYmd === day && s.inYmd < day),
  );
  const endStays = nightStays(input.stays, day, includeWaiting);
  const dayUseStays = input.stays.filter(
    (s) =>
      s.inYmd === day &&
      s.outYmd === day &&
      (s.status === 'IN_HOUSE' || s.status === 'CONFIRMED' || (includeWaiting && s.status === 'OPTION')),
  );

  const inHouse = matrixOf(inHouseStays);
  const endOfDay = matrixOf(endStays);
  const start = matrixOf(startStays);
  const realizedIn = matrixOf(realizedArrivals);
  const realizedOut = matrixOf(realizedDepartures);
  const expIn = matrixOf(expectedArrivals);
  const expOut = matrixOf(expectedDepartures);

  const movement = [
    { key: 'start', rooms: start.rooms, pax: start.pax },
    { key: 'realizedArrivals', rooms: realizedIn.rooms, pax: realizedIn.pax },
    { key: 'realizedDepartures', rooms: realizedOut.rooms, pax: realizedOut.pax },
    { key: 'current', rooms: inHouse.rooms, pax: inHouse.pax },
    { key: 'expectedArrivals', rooms: expIn.rooms, pax: expIn.pax },
    { key: 'expectedDepartures', rooms: expOut.rooms, pax: expOut.pax },
    { key: 'endOfDay', rooms: endOfDay.rooms, pax: endOfDay.pax },
  ].map((row) => ({ ...row, percent: pct(row.rooms, input.capacity) }));

  const clean = {
    clean: 0,
    closed: 0,
    confirmed: 0,
    dirty: 0,
    maintenance: 0,
    reserved: 0,
    touched: 0,
  };
  for (const room of input.rooms) {
    if (room.inventory === 'OOO') clean.closed += 1;
    else if (room.inventory === 'OOS' || room.status === 'MAINTENANCE') clean.maintenance += 1;
    else if (room.hk === 'DIRTY') clean.dirty += 1;
    else if (room.hk === 'PICKUP') clean.touched += 1;
    else clean.clean += 1;
  }

  const dayUse = matrixOf(dayUseStays).rooms;
  const blocks = 0;
  const available = Math.max(0, input.capacity - endOfDay.rooms - dayUse - blocks - ooo);

  const forecast: ForecastPoint[] = input.forecastDays.map((forecastDay) => {
    const onNight = nightStays(input.stays, forecastDay, includeWaiting);
    const counted = matrixOf(onNight);
    let individual = 0;
    let group = 0;
    let complimentary = 0;
    let houseUse = 0;
    const doors = new Map<string, DashStay[]>();
    for (const s of onNight) {
      const key = s.roomId ?? `stay:${s.id}`;
      const list = doors.get(key) ?? [];
      list.push(s);
      doors.set(key, list);
    }
    for (const [key, list] of doors) {
      const rooms = key.startsWith('stay:') ? Math.max(1, list[0].roomCount) : 1;
      if (list.some((s) => s.group)) group += rooms;
      else individual += rooms;
      const kinds = list.map((s) => accomKind(s.accomType));
      if (kinds.includes('COMP')) complimentary += rooms;
      else if (kinds.includes('HOUSE')) houseUse += rooms;
    }
    const onNightIds = new Set(onNight.map((s) => s.id));
    const nightRevenue = input.withRevenue
      ? input.nightRates.reduce(
          (sum, rate) =>
            rate.day === forecastDay && onNightIds.has(rate.reservationId) ? sum + rate.amount : sum,
          0,
        )
      : 0;
    const occupied = counted.rooms;
    const sold = Math.max(0, occupied - complimentary - houseUse);
    const arriving = matrixOf(
      input.stays.filter((s) => s.inYmd === forecastDay && sells(s.status, includeWaiting) && s.status !== 'NO_SHOW' && s.status !== 'CANCELLED'),
    ).rooms;
    const departing = matrixOf(
      input.stays.filter((s) => s.outYmd === forecastDay && sells(s.status, includeWaiting)),
    ).rooms;
    return {
      day: forecastDay,
      occupied,
      available: Math.max(0, input.capacity - occupied - ooo),
      blocks,
      closed: ooo,
      arriving,
      departing,
      individual,
      group,
      revenue: round2(nightRevenue),
      adults: counted.adults,
      child1: counted.child1,
      child2: counted.child2,
      baby: counted.baby,
      sold,
      complimentary,
      houseUse,
    };
  });

  const salesStays = input.stays.filter(
    (s) =>
      s.createdYmd >= input.monthStart &&
      s.createdYmd <= day &&
      s.status !== 'CANCELLED' &&
      s.status !== 'NO_SHOW',
  );
  const cancelStays = input.stays.filter(
    (s) => s.status === 'CANCELLED' && s.updatedYmd >= input.monthStart && s.updatedYmd <= day,
  );

  let roomGross = 0;
  let roomNet = 0;
  let food = 0;
  let beverage = 0;
  let other = 0;
  for (const c of input.charges) {
    const net = c.vatRate > 0 ? c.gross / (1 + c.vatRate) : c.gross;
    if (c.kind === 'room') {
      roomGross += c.gross;
      roomNet += net;
    } else if (c.kind === 'food') food += c.gross;
    else if (c.kind === 'beverage') beverage += c.gross;
    else other += c.gross;
  }
  if (roomGross === 0 && food === 0 && beverage === 0 && other === 0) {
    const endIds = new Set(endStays.map((s) => s.id));
    const fallback = input.nightRates
      .filter((r) => r.day === day && endIds.has(r.reservationId))
      .reduce((sum, r) => sum + r.amount, 0);
    roomGross = fallback;
    roomNet = fallback / 1.18;
  }
  const totalRevenue = roomGross + food + beverage + other;
  const occRooms = endOfDay.rooms;

  const soldByType = new Map<string, number>();
  const seenType = new Set<string>();
  for (const s of endStays) {
    const key = s.roomId ?? `stay:${s.id}`;
    if (seenType.has(key)) continue;
    seenType.add(key);
    const rooms = key.startsWith('stay:') ? Math.max(1, s.roomCount) : 1;
    soldByType.set(s.roomTypeCode, (soldByType.get(s.roomTypeCode) ?? 0) + rooms);
  }

  const boardMap = new Map<string, number>();
  const seenBoard = new Set<string>();
  for (const s of endStays) {
    const key = s.roomId ?? `stay:${s.id}`;
    if (seenBoard.has(key)) continue;
    seenBoard.add(key);
    const code = s.mealCode ?? '—';
    const rooms = key.startsWith('stay:') ? Math.max(1, s.roomCount) : 1;
    boardMap.set(code, (boardMap.get(code) ?? 0) + rooms);
  }

  const repeatIds = new Set(inHouseStays.filter((s) => s.guestVisits > 1).map((s) => s.guestId));
  const folio = new Map<string, number>();
  for (const s of endStays) folio.set(s.paymentMethod, (folio.get(s.paymentMethod) ?? 0) + 1);

  const todayReservations = input.stays
    .filter((s) => s.createdYmd === day && s.status !== 'CANCELLED')
    .map(toRow);

  return {
    day,
    capacity: input.capacity,
    bedCapacity: input.bedCapacity,
    inHouse,
    expectedArrivals: expIn,
    expectedDepartures: expOut,
    endOfDay,
    movement,
    clean,
    occupancyPie: { occupied: endOfDay.rooms, available, blocks, dayUse },
    forecast,
    sales: flowCard(salesStays, input.capacity, input.bedCapacity, input.mtdDays),
    cancellations: flowCard(cancelStays, input.capacity, input.bedCapacity, input.mtdDays),
    occupancy: {
      resCount: occRooms,
      roomNights: occRooms,
      paxNights: endOfDay.pax,
      roomPercent: pct(occRooms, input.capacity),
      bedPercent: input.bedCapacity == null ? null : pct(endOfDay.pax, input.bedCapacity),
      adr: occRooms > 0 ? round2(roomGross / occRooms) : null,
      revenue: round2(totalRevenue),
    },
    revenues: {
      room: round2(roomGross),
      food: round2(food),
      beverage: round2(beverage),
      other: round2(other),
      roomNet: round2(roomNet),
      netAdr: occRooms > 0 ? round2(roomNet / occRooms) : null,
      total: round2(totalRevenue),
    },
    roomTypes: input.roomTypeQuota.map((rt) => {
      const sold = soldByType.get(rt.code) ?? 0;
      return { ...rt, sold, available: Math.max(0, rt.quota - sold) };
    }),
    board: [...boardMap.entries()].map(([code, rooms]) => ({ code, rooms })).sort((a, b) => b.rooms - a.rooms),
    ages: { adults: endOfDay.adults, child1: endOfDay.child1, child2: endOfDay.child2, baby: endOfDay.baby },
    repeatGuests: repeatIds.size,
    todayReservations,
    folioTypes: [...folio.entries()].map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
    lists: {
      expectedArrivals: expectedArrivals.map(toRow),
      expectedDepartures: expectedDepartures.map(toRow),
      realizedArrivals: realizedArrivals.map(toRow),
      realizedDepartures: realizedDepartures.map(toRow),
    },
  };
}
