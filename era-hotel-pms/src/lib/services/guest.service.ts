import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import {
  assertGuestMdmStrict,
  enrichGuestWithMdmProfile,
  linkGuestPersonIdentity,
  updateGuestIdentity,
  type TransientGuestIdentity,
} from '@/lib/guest-identity';
import {
  GUEST_FIN_DOC_TYPES,
  GUEST_PASSPORT_DOC_TYPES,
  mapGuestToListItem,
  type GuestListItem,
} from '@/lib/guest-list-identity';
import { normalizeGuestInput, type CreateGuestInput } from '@/lib/guest-input';
import {
  normalizeListPagination,
  type PaginatedList,
} from '@era/satellite-kit';
import type { Prisma } from '@prisma/client';

export {
  linkGuestPersonIdentity,
  updateGuestIdentity,
  enrichGuestWithMdmProfile,
  GuestMdmRequiredError,
} from '@/lib/guest-identity';

export type { GuestListItem } from '@/lib/guest-list-identity';

/** @deprecated Use updateGuestIdentity */
export async function relinkGuestGlobalPerson(
  guestId: string,
  input: TransientGuestIdentity,
): Promise<string | null> {
  return updateGuestIdentity(guestId, input);
}

export type ListGuestsQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  gender?: string;
  nationality?: string;
  fin?: string;
  passport?: string;
  birthDateFrom?: string;
  birthDateTo?: string;
  email?: string;
  phone?: string;
  externalRef?: string;
};

const guestListSelect = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  title: true,
  sex: true,
  nationality: true,
  birthDate: true,
  birthPlace: true,
  phone: true,
  email: true,
  externalRef: true,
  globalPersonId: true,
  vehiclePlate: true,
  registrationNumber: true,
  visaNumber: true,
  documents: {
    select: { docType: true, docNumber: true, isPrimary: true },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'desc' as const }],
  },
} satisfies Prisma.GuestSelect;

function parseDateOnly(value?: string): Date | null {
  const s = value?.trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function guestListWhere(input: ListGuestsQuery): Prisma.GuestWhereInput {
  const and: Prisma.GuestWhereInput[] = [];

  const query = input.q?.trim();
  if (query) {
    and.push({
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { middleName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { externalRef: { contains: query, mode: 'insensitive' } },
        { registrationNumber: { contains: query, mode: 'insensitive' } },
        { vehiclePlate: { contains: query, mode: 'insensitive' } },
        { visaNumber: { contains: query, mode: 'insensitive' } },
        { documents: { some: { docNumber: { contains: query, mode: 'insensitive' } } } },
      ],
    });
  }

  const gender = input.gender?.trim();
  if (gender) {
    and.push({ sex: gender });
  }

  const nationality = input.nationality?.trim();
  if (nationality) {
    and.push({ nationality });
  }

  const fin = input.fin?.trim();
  if (fin) {
    and.push({
      documents: {
        some: {
          docType: { in: [...GUEST_FIN_DOC_TYPES] },
          docNumber: { contains: fin, mode: 'insensitive' },
        },
      },
    });
  }

  const passport = input.passport?.trim();
  if (passport) {
    and.push({
      documents: {
        some: {
          docType: { in: [...GUEST_PASSPORT_DOC_TYPES] },
          docNumber: { contains: passport, mode: 'insensitive' },
        },
      },
    });
  }

  const email = input.email?.trim();
  if (email) {
    and.push({ email: { contains: email, mode: 'insensitive' } });
  }

  const phone = input.phone?.trim();
  if (phone) {
    and.push({ phone: { contains: phone, mode: 'insensitive' } });
  }

  const externalRef = input.externalRef?.trim();
  if (externalRef) {
    and.push({ externalRef: { contains: externalRef, mode: 'insensitive' } });
  }

  const birthFrom = parseDateOnly(input.birthDateFrom);
  const birthTo = parseDateOnly(input.birthDateTo);
  if (birthFrom || birthTo) {
    and.push({
      birthDate: {
        ...(birthFrom ? { gte: birthFrom } : {}),
        ...(birthTo ? { lte: birthTo } : {}),
      },
    });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0]!;
  return { AND: and };
}

export async function listGuests(
  input: ListGuestsQuery | string = {},
): Promise<PaginatedList<GuestListItem>> {
  const opts: ListGuestsQuery =
    typeof input === 'string' ? { q: input } : (input ?? {});
  const { page, pageSize, skip } = normalizeListPagination(
    opts.page,
    opts.pageSize,
  );
  const where = guestListWhere(opts);

  const [rows, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      select: guestListSelect,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.guest.count({ where }),
  ]);

  return {
    items: rows.map(mapGuestToListItem),
    total,
    page,
    pageSize,
  };
}

export async function createGuest(input: CreateGuestInput) {
  const globalPersonId =
    input.globalPersonId?.trim() ||
    (await linkGuestPersonIdentity({
      fullName: input.fullName,
      nationalIdFin: input.nationalIdFin,
      passportNumber: input.passportNumber,
      nationality: input.nationality,
      phone: input.phone,
    }));

  assertGuestMdmStrict(input, globalPersonId);

  const data = normalizeGuestInput(input);
  if (globalPersonId) data.globalPersonId = globalPersonId;

  return prisma.guest.create({
    data: {
      ...data,
      organizationId: requestOrganizationId(),
    },
  });
}
