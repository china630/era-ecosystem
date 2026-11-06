import { normalizePersonPhone } from '@era/satellite-kit';
import { showWarning } from '@era/satellite-kit/ui';

export type GuestPhonePolishToast = (key: 'phoneNeedsRegion' | 'phoneConflict' | 'phoneInvalid') => string;

/**
 * Apply kit phone polish for guest card / contacts.
 * Toast only for needs_region / conflict / invalid; polished updates silently.
 */
export function applyGuestPhonePolish(
  raw: string | null | undefined,
  nationalityIso: string | null | undefined,
  t: GuestPhonePolishToast,
): { display: string; status: string; e164: string | null } {
  const result = normalizePersonPhone({ raw, nationalityIso });
  if (result.status === 'needs_region') {
    showWarning(t('phoneNeedsRegion'));
  } else if (result.status === 'conflict') {
    showWarning(t('phoneConflict'));
  } else if (result.status === 'invalid') {
    showWarning(t('phoneInvalid'));
  }
  return {
    display: result.display,
    status: result.status,
    e164: result.e164,
  };
}
