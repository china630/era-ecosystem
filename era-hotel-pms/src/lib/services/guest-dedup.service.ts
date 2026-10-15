import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { ymdParam } from '@/lib/reports/civil-days';
import { GUEST_FIN_DOC_TYPES, GUEST_PASSPORT_DOC_TYPES } from '@/lib/guest-list-identity';
import { requestOrganizationId } from '@/lib/request-organization';
import { dedupPair } from '@/lib/services/guest-merge.service';

export type GuestDedupSummary = {
  totalGuests: number;
  withoutGlobalPersonId: number;
  withoutMdmLink: number;
  suspectedDuplicateGroups: number;
  suspectedDuplicateGuests: number;
};

export type DedupMatchType =
  | 'PHONE'
  | 'GLOBAL_PERSON_ID'
  | 'PASSPORT'
  | 'FIN'
  | 'EMAIL'
  | 'NAME_BIRTH'
  | 'LAST_BIRTH'
  | 'LAST_PHONE'
  | 'DOC_CITIZENSHIP';

export type DedupGuestCard = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  sex: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  passportNo: string | null;
  fin: string | null;
  linked: boolean;
  stayCount: number;
  inHouse: boolean;
};

export type DuplicateGroup = {
  key: string;
  matchType: DedupMatchType;
  guestIds: string[];
  labels: string[];
  needsPersonMerge: boolean;
  guests: DedupGuestCard[];
};

function groupPairs(ids: string[]) {
  const pairs: Array<{ guestIdLow: string; guestIdHigh: string }> = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) pairs.push(dedupPair(ids[i]!, ids[j]!));
  }
  return pairs;
}

function pairKey(pair: { guestIdLow: string; guestIdHigh: string }) {
  return `${pair.guestIdLow}:${pair.guestIdHigh}`;
}

export async function getGuestDedupSummary(): Promise<GuestDedupSummary> {
  const guests = await prisma.guest.findMany({
    select: {
      id: true,
      globalPersonId: true,
      phone: true,
    },
  });

  const withoutGlobalPersonId = guests.filter((g) => !g.globalPersonId).length;
  const withoutMdmLink = withoutGlobalPersonId;

  const phoneMap = new Map<string, string[]>();
  const personMap = new Map<string, string[]>();

  for (const g of guests) {
    const phone = g.phone?.replace(/\s+/g, '').trim();
    if (phone && phone.length >= 9) {
      const list = phoneMap.get(phone) ?? [];
      list.push(g.id);
      phoneMap.set(phone, list);
    }
    const pid = g.globalPersonId?.trim();
    if (pid) {
      const list = personMap.get(pid) ?? [];
      list.push(g.id);
      personMap.set(pid, list);
    }
  }

  const groups: Array<{ guestIds: string[] }> = [];
  for (const [, ids] of phoneMap) {
    if (ids.length > 1) groups.push({ guestIds: ids });
  }
  for (const [, ids] of personMap) {
    if (ids.length > 1) groups.push({ guestIds: ids });
  }
  const dismissed = await prisma.guestDedupDismissal.findMany({
    select: { guestIdLow: true, guestIdHigh: true },
  });
  const dismissedKeys = new Set(dismissed.map(pairKey));
  const visible = groups.filter((group) =>
    groupPairs(group.guestIds).some((pair) => !dismissedKeys.has(pairKey(pair))),
  );

  const dupGuestIds = new Set(visible.flatMap((g) => g.guestIds));

  return {
    totalGuests: guests.length,
    withoutGlobalPersonId,
    withoutMdmLink,
    suspectedDuplicateGroups: visible.length,
    suspectedDuplicateGuests: dupGuestIds.size,
  };
}

export async function listDuplicateGroups(limit = 50): Promise<DuplicateGroup[]> {
  const guests = await prisma.guest.findMany({
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      email: true,
      phone: true,
      nationality: true,
      globalPersonId: true,
      documents: { select: { docType: true, docNumber: true, nationality: true } },
    },
  });

  const buckets = new Map<string, { matchType: DedupMatchType; key: string; ids: string[] }>();
  function add(matchType: DedupMatchType, key: string, guestId: string) {
    const bucketKey = `${matchType}:${key}`;
    const bucket = buckets.get(bucketKey) ?? { matchType, key, ids: [] };
    if (!bucket.ids.includes(guestId)) bucket.ids.push(guestId);
    buckets.set(bucketKey, bucket);
  }
  function docKey(docs: Array<{ docType: string; docNumber: string }>, kinds: Set<string>) {
    const raw = docs.find(
      (row) => kinds.has(String(row.docType ?? '').toUpperCase()) && row.docNumber.trim(),
    )?.docNumber;
    return raw ? raw.replace(/[\s-]/g, '').toUpperCase() : '';
  }

  for (const g of guests) {
    const phone = g.phone?.replace(/\s+/g, '').trim();
    if (phone && phone.length >= 9) add('PHONE', phone, g.id);
    const pid = g.globalPersonId?.trim();
    if (pid) add('GLOBAL_PERSON_ID', pid, g.id);
    const passport = docKey(g.documents, GUEST_PASSPORT_DOC_TYPES);
    if (passport.length >= 4) add('PASSPORT', passport, g.id);
    const fin = docKey(g.documents, GUEST_FIN_DOC_TYPES);
    if (fin.length >= 5) add('FIN', fin, g.id);
    const email = g.email?.trim().toLowerCase();
    if (email?.includes('@')) add('EMAIL', email, g.id);
    const birth = g.birthDate ? ymdParam(g.birthDate) : '';
    const last = (g.lastName ?? '').trim().toLowerCase();
    const first = (g.firstName ?? '').trim().toLowerCase();
    const name = last && first ? `${last}|${first}` : (g.fullName ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (birth && name) add('NAME_BIRTH', `${name}|${birth}`, g.id);
    if (birth && last.length >= 2) add('LAST_BIRTH', `${last}|${birth}`, g.id);
    const phoneTail = (g.phone ?? '').replace(/\D/g, '').slice(-9);
    if (last.length >= 2 && phoneTail.length === 9) add('LAST_PHONE', `${last}|${phoneTail}`, g.id);
    const citizenship = (g.nationality ?? '').trim().toUpperCase();
    for (const doc of g.documents) {
      const number = doc.docNumber.replace(/[\s-]/g, '').toUpperCase();
      const country = (doc.nationality ?? citizenship).trim().toUpperCase();
      if (number.length >= 4 && country) add('DOC_CITIZENSHIP', `${number}|${country}`, g.id);
    }
  }

  const groups: Array<{
    key: string;
    matchType: DuplicateGroup['matchType'];
    guestIds: string[];
    labels: string[];
  }> = [];
  for (const bucket of buckets.values()) {
    if (bucket.ids.length < 2) continue;
    groups.push({
      key: bucket.key,
      matchType: bucket.matchType,
      guestIds: bucket.ids,
      labels: [],
    });
  }

  const dismissed = await prisma.guestDedupDismissal.findMany({
    select: { guestIdLow: true, guestIdHigh: true },
  });
  const dismissedKeys = new Set(dismissed.map(pairKey));
  const visible = groups.filter((group) => {
    const pairs = groupPairs(group.guestIds);
    return pairs.some((pair) => !dismissedKeys.has(pairKey(pair)));
  });

  const ids = [...new Set(visible.flatMap((group) => group.guestIds))];
  const people = ids.length
    ? await prisma.guest.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          sex: true,
          nationality: true,
          phone: true,
          email: true,
          globalPersonId: true,
          documents: { select: { docType: true, docNumber: true } },
        },
      })
    : [];
  const stays = ids.length
    ? await prisma.reservation.findMany({
        where: {
          OR: [{ guestId: { in: ids } }, { paxGuests: { some: { guestId: { in: ids } } } }],
        },
        select: {
          status: true,
          guestId: true,
          paxGuests: { select: { guestId: true } },
        },
      })
    : [];

  function docNumber(docs: Array<{ docType: string; docNumber: string }>, kinds: Set<string>) {
    return (
      docs.find(
        (row) => kinds.has(String(row.docType ?? '').toUpperCase()) && row.docNumber.trim(),
      )?.docNumber.trim() ?? null
    );
  }

  const cards = new Map<string, DedupGuestCard>();
  for (const person of people) {
    const linkedStays = stays.filter(
      (stay) =>
        stay.guestId === person.id || stay.paxGuests.some((pax) => pax.guestId === person.id),
    );
    cards.set(person.id, {
      id: person.id,
      fullName: person.fullName,
      firstName: person.firstName,
      lastName: person.lastName,
      birthDate: person.birthDate ? ymdParam(person.birthDate) : null,
      email: person.email,
      sex: person.sex,
      nationality: person.nationality,
      phone: person.phone,
      passportNo: docNumber(person.documents, GUEST_PASSPORT_DOC_TYPES),
      fin: docNumber(person.documents, GUEST_FIN_DOC_TYPES),
      linked: Boolean(person.globalPersonId),
      stayCount: linkedStays.length,
      inHouse: linkedStays.some((stay) => stay.status === 'IN_HOUSE'),
    });
  }

  return visible.slice(0, limit).map((group) => {
    const guests = group.guestIds
      .map((id) => cards.get(id))
      .filter((card): card is DedupGuestCard => Boolean(card));
    const personIds = guests.map((card) => people.find((row) => row.id === card.id)?.globalPersonId).filter(Boolean);
    const needsPersonMerge = new Set(personIds).size > 1;
    return { ...group, guests, needsPersonMerge };
  });
}

export async function dismissDuplicateGroup(guestIds: string[]) {
  const ids = [...new Set(guestIds.filter(Boolean))];
  if (ids.length < 2) throw new Error('Nothing to dismiss');
  const organizationId = requestOrganizationId();
  for (const pair of groupPairs(ids)) {
    await prisma.guestDedupDismissal.upsert({
      where: {
        organizationId_guestIdLow_guestIdHigh: {
          organizationId,
          guestIdLow: pair.guestIdLow,
          guestIdHigh: pair.guestIdHigh,
        },
      },
      create: { organizationId, ...pair },
      update: {},
    });
  }
}

export async function resolveCreditLimitAzn(reservationId: string): Promise<number | null> {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      creditLimitAzn: true,
      agency: { select: { creditLimitAzn: true } },
    },
  });
  if (res?.creditLimitAzn != null) {
    return decimalToNumber(res.creditLimitAzn);
  }
  if (res?.agency?.creditLimitAzn != null) {
    return decimalToNumber(res.agency.creditLimitAzn);
  }
  const profile = await prisma.hotelProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { defaultCreditLimitAzn: true },
  });
  if (profile?.defaultCreditLimitAzn != null) {
    return decimalToNumber(profile.defaultCreditLimitAzn);
  }
  return null;
}
