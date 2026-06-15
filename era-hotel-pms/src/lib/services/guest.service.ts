import { linkPersonIdentity } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { normalizeGuestInput, type CreateGuestInput, type GuestNationality } from '@/lib/guest-input';

function toGuestNationality(value?: string): GuestNationality {
  return value === 'OTHER' ? 'OTHER' : 'AZ';
}

export async function resolveGuestGlobalPersonId(
  input: CreateGuestInput,
): Promise<string | null> {
  if (input.globalPersonId?.trim()) return input.globalPersonId.trim();
  const fin = input.nationalIdFin?.trim();
  const passport = input.passportNumber?.trim();
  if (!fin && !passport && !input.fullName?.trim()) return null;
  const issuingCountry =
    input.nationality === 'AZ' ? 'AZ' : input.nationality === 'OTHER' ? undefined : input.nationality;
  const linked = await linkPersonIdentity({
    fin: fin || undefined,
    passport: passport || undefined,
    issuingCountry,
    fullName: input.fullName,
    phone: input.phone ?? undefined,
    nationality: input.nationality === 'AZ' ? 'AZ' : 'OTHER',
  });
  return linked.globalPersonId;
}

export async function relinkGuestGlobalPerson(
  guestId: string,
  input: {
    fullName: string;
    nationalIdFin?: string | null;
    passportNumber?: string | null;
    nationality?: string;
    phone?: string | null;
  },
): Promise<string | null> {
  const globalPersonId = await resolveGuestGlobalPersonId({
    fullName: input.fullName,
    nationalIdFin: input.nationalIdFin ?? undefined,
    passportNumber: input.passportNumber ?? undefined,
    nationality: toGuestNationality(input.nationality),
    phone: input.phone ?? undefined,
  });
  if (globalPersonId) {
    await prisma.guest.update({
      where: { id: guestId },
      data: { globalPersonId },
    });
  }
  return globalPersonId;
}

export async function listGuests() {
  return prisma.guest.findMany({ orderBy: { fullName: 'asc' } });
}

export async function createGuest(input: CreateGuestInput) {
  const data = normalizeGuestInput(input);
  if (!data.globalPersonId) {
    const globalPersonId = await resolveGuestGlobalPersonId(input);
    if (globalPersonId) data.globalPersonId = globalPersonId;
  }
  const strict = process.env.ERA_HOTEL_GUEST_MDM_STRICT === 'true';
  if (strict) {
    const hasIdentifier =
      Boolean(input.nationalIdFin?.trim()) ||
      Boolean(input.passportNumber?.trim()) ||
      Boolean(data.globalPersonId);
    if (!hasIdentifier) {
      throw new Error('Guest must have FIN or passport for MDM link');
    }
  }
  return prisma.guest.create({ data });
}
