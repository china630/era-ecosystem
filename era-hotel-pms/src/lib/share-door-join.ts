import { normalizeShareGender } from '@/lib/share-gender';

function isEffectiveShare(r: {
  shareEligible?: boolean;
  shareGender?: string | null;
  adults?: number;
}): boolean {
  if (!r.shareEligible) return false;
  if ((r.adults ?? 1) !== 1) return false;
  return normalizeShareGender(r.shareGender) != null;
}

/**
 * Whether FO may pick an already-occupied door for assign (open same-gender pool
 * or closed opposite pair). Exclusive / family stays still block.
 */
export function canJoinOccupiedDoor(input: {
  candidate: { shareEligible: boolean; adults: number; gender: string | null };
  overlapping: Array<{
    shareEligible?: boolean;
    shareGender?: string | null;
    adults?: number;
  }>;
  maxBed: number;
}): boolean {
  if (input.overlapping.length === 0) return true;
  if (!input.candidate.shareEligible || input.candidate.adults !== 1) return false;
  const candGender = normalizeShareGender(input.candidate.gender);
  if (!candGender) return false;

  const shares = input.overlapping.filter(isEffectiveShare);
  if (shares.length !== input.overlapping.length) return false;

  const maxBed = Math.max(1, input.maxBed);
  if (shares.length >= maxBed) return false;

  const genders = new Set(
    shares
      .map((s) => normalizeShareGender(s.shareGender))
      .filter((g): g is NonNullable<typeof g> => g != null),
  );
  if (genders.size > 1) return false;
  const poolGender = [...genders][0];
  if (poolGender === candGender) return true;
  return shares.length === 1 && maxBed >= 2;
}
