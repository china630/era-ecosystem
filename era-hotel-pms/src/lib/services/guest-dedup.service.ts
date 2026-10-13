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

export type DedupGuestCard = {
  id: string;
  fullName: string;
  birthDate: string | null;
  sex: string | null;
  nationality: string | null;
  phone: string | null;
  passportNo: string | null;
  fin: string | null;
  linked: boolean;
  stayCount: number;
  inHouse: boolean;
};

export type DuplicateGroup = {
  key: string;
  matchType: 'PHONE' | 'GLOBAL_PERSON_ID';
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
      phone: true,
      globalPersonId: true,
    },
  });

  const byPhone = new Map<string, typeof guests>();
  const byPerson = new Map<string, typeof guests>();

  for (const g of guests) {
    const phone = g.phone?.replace(/\s+/g, '').trim();
    if (phone && phone.length >= 9) {
      const list = byPhone.get(phone) ?? [];
      list.push(g);
      byPhone.set(phone, list);
    }
    const pid = g.globalPersonId?.trim();
    if (pid) {
      const list = byPerson.get(pid) ?? [];
      list.push(g);
      byPerson.set(pid, list);
    }
  }

  const groups: Array<{
    key: string;
    matchType: DuplicateGroup['matchType'];
    guestIds: string[];
    labels: string[];
  }> = [];
  for (const [key, list] of byPhone) {
    if (list.length > 1) {
      groups.push({
        key,
        matchType: 'PHONE',
        guestIds: list.map((g) => g.id),
        labels: list.map((g) => g.fullName ?? g.id),
      });
    }
  }
  for (const [key, list] of byPerson) {
    if (list.length > 1) {
      groups.push({
        key,
        matchType: 'GLOBAL_PERSON_ID',
        guestIds: list.map((g) => g.id),
        labels: list.map((g) => g.fullName ?? g.id),
      });
    }
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
          birthDate: true,
          sex: true,
          nationality: true,
          phone: true,
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
      birthDate: person.birthDate ? ymdParam(person.birthDate) : null,
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
