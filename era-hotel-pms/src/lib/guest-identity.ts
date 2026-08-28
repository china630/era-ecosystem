import {
  getPersonOpsProfile,
  linkPersonIdentity,
  type PersonOpsProfile,
} from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

export class GuestMdmRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuestMdmRequiredError';
  }
}

export type TransientGuestIdentity = {
  fullName: string;
  nationalIdFin?: string | null;
  passportNumber?: string | null;
  issuingCountry?: string | null;
  phone?: string | null;
  nationality?: string;
  globalPersonId?: string | null;
  gender?: string | null;
  birthDate?: string | Date | null;
};

function toIssuingCountry(nationality?: string): string | undefined {
  if (!nationality || nationality === 'OTHER') return undefined;
  return nationality;
}

export async function linkGuestPersonIdentity(
  input: TransientGuestIdentity,
): Promise<string | null> {
  const fin = input.nationalIdFin?.trim();
  const passport = input.passportNumber?.trim();
  const globalPersonId = input.globalPersonId?.trim();
  if (!fin && !passport && !globalPersonId && !input.fullName?.trim()) return null;

  const linked = await linkPersonIdentity({
    fin: fin || undefined,
    passport: passport || undefined,
    issuingCountry: input.issuingCountry ?? toIssuingCountry(input.nationality),
    fullName: input.fullName.trim(),
    phone: input.phone ?? undefined,
    nationality: input.nationality === 'AZ' ? 'AZ' : 'OTHER',
    globalPersonId: globalPersonId || undefined,
    gender: input.gender ?? undefined,
    birthDate: input.birthDate ?? undefined,
  });
  return linked.globalPersonId ?? globalPersonId ?? null;
}

export async function updateGuestIdentity(
  guestId: string,
  input: TransientGuestIdentity,
): Promise<string | null> {
  const globalPersonId = await linkGuestPersonIdentity(input);
  if (globalPersonId) {
    await prisma.guest.update({
      where: { id: guestId },
      data: { globalPersonId },
    });
  }
  return globalPersonId;
}

export async function fetchGuestMdmProfile(
  globalPersonId: string | null | undefined,
): Promise<PersonOpsProfile | null> {
  if (!globalPersonId?.trim()) return null;
  return getPersonOpsProfile(globalPersonId.trim());
}

export async function enrichGuestWithMdmProfile<
  T extends { globalPersonId?: string | null },
>(guest: T): Promise<T & { mdmProfile: PersonOpsProfile | null }> {
  const mdmProfile = await fetchGuestMdmProfile(guest.globalPersonId);
  return { ...guest, mdmProfile };
}

export function assertGuestMdmStrict(
  _input: TransientGuestIdentity,
  globalPersonId: string | null | undefined,
): void {
  const strict = process.env.ERA_HOTEL_GUEST_MDM_STRICT === 'true';
  if (!strict) return;
  if (!globalPersonId?.trim()) {
    throw new GuestMdmRequiredError(
      'Guest must have FIN or passport resolved to MDM globalPersonId',
    );
  }
}
