/** Seed codes for ClinicLookup BODY_PART. Runtime checks read the lookup. */
export const BODY_PART_CODES = [
  "HEAD",
  "NECK",
  "CHEST",
  "BACK",
  "ABDOMEN",
  "ARM_LEFT",
  "ARM_RIGHT",
  "LEG_LEFT",
  "LEG_RIGHT",
  "FULL_BODY",
] as const;

export type BodyPartCode = (typeof BODY_PART_CODES)[number];
