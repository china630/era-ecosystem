import { normalizePersonPhone } from '@era/satellite-kit';

/**
 * Persist value for Guest.phone / phone-like GuestContact.
 * Polished → E.164; conflict / needs_region / invalid → trimmed raw (never 400).
 */
export function persistGuestPhone(
  raw: string | null | undefined,
  nationalityIso: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const result = normalizePersonPhone({ raw, nationalityIso });
  if (result.status === 'empty') return null;
  if (result.status === 'polished' || result.status === 'unchanged') {
    return result.e164 ?? result.display;
  }
  return result.display;
}
