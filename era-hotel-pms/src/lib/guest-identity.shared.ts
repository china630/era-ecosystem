import { composePersonFullName } from '@/lib/person-documents';

export class GuestMdmRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuestMdmRequiredError';
  }
}

export type TransientGuestIdentity = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  /** Legacy blob; prefer parts. */
  fullName?: string | null;
  nationalIdFin?: string | null;
  passportNumber?: string | null;
  issuingCountry?: string | null;
  phone?: string | null;
  /** ISO 3166-1 alpha-2 citizenship on guest cache. */
  nationality?: string | null;
  globalPersonId?: string | null;
  sex?: string | null;
  /** @deprecated alias for sex on wire */
  gender?: string | null;
  birthDate?: string | Date | null;
};

/** Compose denorm fullName for Guest write paths (client-safe). */
export function guestComposedFullName(input: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  return (
    composePersonFullName(input.firstName, input.middleName, input.lastName) ||
    input.fullName?.trim() ||
    ''
  );
}

export function resolveGuestFullName(input: TransientGuestIdentity): string {
  const composed = composePersonFullName(
    input.firstName,
    input.middleName,
    input.lastName,
  );
  return composed || input.fullName?.trim() || '';
}
