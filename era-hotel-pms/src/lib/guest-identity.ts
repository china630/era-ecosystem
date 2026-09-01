import {
  linkPersonIdentity,
  type PersonOpsProfile,
} from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { mapNationalityToIso } from '@/lib/person-documents';
import {
  GuestMdmRequiredError,
  resolveGuestFullName,
  type TransientGuestIdentity,
} from '@/lib/guest-identity.shared';

export {
  GuestMdmRequiredError,
  guestComposedFullName,
  type TransientGuestIdentity,
} from '@/lib/guest-identity.shared';

function mdmNationality(raw?: string | null): string | undefined {
  const iso = mapNationalityToIso(raw ?? undefined);
  if (!iso || iso === 'OTHER') return undefined;
  return iso;
}

export async function linkGuestPersonIdentity(
  input: TransientGuestIdentity,
): Promise<string | null> {
  const fin = input.nationalIdFin?.trim();
  const passport = input.passportNumber?.trim();
  const globalPersonId = input.globalPersonId?.trim();
  const fullName = resolveGuestFullName(input);
  if (!fin && !passport && !globalPersonId && !fullName) return null;

  const linked = await linkPersonIdentity({
    fin: fin || undefined,
    passport: passport || undefined,
    issuingCountry: input.issuingCountry?.trim() || undefined,
    firstName: input.firstName?.trim() || undefined,
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName?.trim() || undefined,
    fullName: fullName || undefined,
    phone: input.phone?.trim() || undefined,
    nationality: mdmNationality(input.nationality),
    globalPersonId: globalPersonId || undefined,
    sex: input.sex ?? input.gender ?? undefined,
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
  const { getPersonOpsProfile } = await import('@era/satellite-kit');
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
