/** Canonical BodyPart codes (ClinicLookup BODY_PART is SatAdmin SoR). */
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
