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

export async function listGuests() {
  const rows = await prisma.guest.findMany({ orderBy: { fullName: 'asc' } });
  return rows;
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
