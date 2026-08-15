import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

export type GuestDedupSummary = {
  totalGuests: number;
  withoutGlobalPersonId: number;
  withoutMdmLink: number;
  suspectedDuplicateGroups: number;
  suspectedDuplicateGuests: number;
};

export type DuplicateGroup = {
  key: string;
  matchType: 'PHONE' | 'GLOBAL_PERSON_ID';
  guestIds: string[];
  labels: string[];
};

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

  const groups: DuplicateGroup[] = [];
  for (const [key, ids] of phoneMap) {
    if (ids.length > 1) {
      groups.push({ key, matchType: 'PHONE', guestIds: ids, labels: ids });
    }
  }
  for (const [key, ids] of personMap) {
    if (ids.length > 1) {
      groups.push({ key, matchType: 'GLOBAL_PERSON_ID', guestIds: ids, labels: ids });
    }
  }

  const dupGuestIds = new Set(groups.flatMap((g) => g.guestIds));

  return {
    totalGuests: guests.length,
    withoutGlobalPersonId,
    withoutMdmLink,
    suspectedDuplicateGroups: groups.length,
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

  const groups: DuplicateGroup[] = [];
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

  return groups.slice(0, limit);
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
