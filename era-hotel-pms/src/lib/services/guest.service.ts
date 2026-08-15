import { prisma } from '@/lib/prisma';
import {
  assertGuestMdmStrict,
  enrichGuestWithMdmProfile,
  linkGuestPersonIdentity,
  updateGuestIdentity,
  type TransientGuestIdentity,
} from '@/lib/guest-identity';
import { normalizeGuestInput, type CreateGuestInput } from '@/lib/guest-input';

export {
  linkGuestPersonIdentity,
  updateGuestIdentity,
  enrichGuestWithMdmProfile,
  GuestMdmRequiredError,
} from '@/lib/guest-identity';

/** @deprecated Use updateGuestIdentity */
export async function relinkGuestGlobalPerson(
  guestId: string,
  input: TransientGuestIdentity,
): Promise<string | null> {
  return updateGuestIdentity(guestId, input);
}

export async function listGuests(q?: string) {
  const query = q?.trim();
  if (!query) {
    return prisma.guest.findMany({ orderBy: { fullName: 'asc' } });
  }
  return prisma.guest.findMany({
    where: {
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { documents: { some: { docNumber: { contains: query, mode: 'insensitive' } } } },
      ],
    },
    orderBy: { fullName: 'asc' },
    take: 50,
  });
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

  return prisma.guest.create({ data });
}
