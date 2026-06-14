import { resolvePersonIdentity } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { normalizeGuestInput, type CreateGuestInput } from '@/lib/guest-input';

async function resolveGuestGlobalPersonId(
  input: CreateGuestInput,
): Promise<string | null> {
  if (input.globalPersonId?.trim()) return input.globalPersonId.trim();
  const fin = input.nationalIdFin?.trim();
  const passport = input.passportNumber?.trim();
  if (!fin && !passport) return null;
  const issuingCountry =
    input.nationality === 'AZ' ? 'AZ' : input.nationality === 'OTHER' ? undefined : input.nationality;
  const r = await resolvePersonIdentity({
    fin: fin || undefined,
    passport: passport || undefined,
    issuingCountry,
    fullName: input.fullName,
    phone: input.phone ?? undefined,
    nationality: input.nationality === 'AZ' ? 'AZ' : 'OTHER',
  });
  return r.globalPersonId;
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
  return prisma.guest.create({ data });
}
