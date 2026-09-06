/**
 * ProcedureType.allowedSiteCodes — which PhysioSite codes the doctor may pick.
 * Empty + needsSite=false → no chips. Empty + needsSite=true → legacy all (pre-seed).
 * Seed always fills a concrete list when needsSite.
 *
 * Clinical / Nafta product rules (FO 2026-09):
 * - Yod-brom / general baths: water ≤ nipple line, heart open, head+neck always out.
 * - Hydromassage: same immersion; jets only back/lumbar/thighs/calves/feet — not heart, breast, groin.
 * - Paraffin ×4 SKUs each have their own family; import prefers WO text.
 * - ESWT: never head.
 * - Lymph: legs; abdomen only when noted (both allowed on picker).
 * - Body wrap (bükmə): full body, head out.
 */

export const ZONE = {
  HEAD: "ZONE-HEAD",
  SCALP: "ZONE-SCALP",
  FACE: "ZONE-FACE",
  NECK: "ZONE-NECK",
  COLLAR: "ZONE-COLLAR",
  UPPER_LIMB: "ZONE-UPPER-LIMB",
  UPPER_LIMB_SCAPULA: "ZONE-UPPER-LIMB-SCAPULA",
  SHOULDER: "ZONE-SHOULDER",
  ELBOW: "ZONE-ELBOW",
  WRIST: "ZONE-WRIST",
  HAND_FOREARM: "ZONE-HAND-FOREARM",
  CHEST: "ZONE-CHEST",
  BACK: "ZONE-BACK",
  ABDOMEN: "ZONE-ABDOMEN",
  LUMBOSACRAL: "ZONE-LUMBOSACRAL",
  BACK_AND_LUMBAR: "ZONE-BACK-AND-LUMBAR",
  CERVICOTHORACIC: "ZONE-CERVICOTHORACIC",
  SPINE_FULL: "ZONE-SPINE-FULL",
  LOWER_LIMB: "ZONE-LOWER-LIMB",
  LOWER_LIMB_LUMBAR: "ZONE-LOWER-LIMB-LUMBAR",
  HIP_GLUTEAL: "ZONE-HIP-GLUTEAL",
  KNEE: "ZONE-KNEE",
  ANKLE: "ZONE-ANKLE",
  FOOT_LEG: "ZONE-FOOT-LEG",
  PANTIES: "ZONE-PANTIES",
  SITZ: "ZONE-SITZ",
  TO_WAIST: "ZONE-TO-WAIST",
  FULL_BODY: "ZONE-FULL-BODY",
  FOUR_CHAMBER: "ZONE-FOUR-CHAMBER",
  COCCYX: "ZONE-COCCYX",
  EAR: "ZONE-EAR",
} as const;

export type PhysioZoneCode = (typeof ZONE)[keyof typeof ZONE];

const HEAD = [ZONE.HEAD, ZONE.SCALP, ZONE.FACE, ZONE.EAR];
const NECK_COLLAR = [ZONE.NECK, ZONE.COLLAR];
const UPPER = [
  ZONE.UPPER_LIMB,
  ZONE.UPPER_LIMB_SCAPULA,
  ZONE.SHOULDER,
  ZONE.ELBOW,
  ZONE.WRIST,
  ZONE.HAND_FOREARM,
];
const SPINE_TRUNK = [
  ZONE.CHEST,
  ZONE.BACK,
  ZONE.ABDOMEN,
  ZONE.LUMBOSACRAL,
  ZONE.BACK_AND_LUMBAR,
  ZONE.CERVICOTHORACIC,
  ZONE.SPINE_FULL,
  ZONE.COCCYX,
  ZONE.PANTIES,
];
const LOWER = [
  ZONE.LOWER_LIMB,
  ZONE.LOWER_LIMB_LUMBAR,
  ZONE.HIP_GLUTEAL,
  ZONE.KNEE,
  ZONE.ANKLE,
  ZONE.FOOT_LEG,
];

/** Surface physio / massage / electro — not hydro fill cells. */
export const SURFACE_ANATOMICAL: PhysioZoneCode[] = [
  ...HEAD,
  ...NECK_COLLAR,
  ...UPPER,
  ...SPINE_TRUNK,
  ...LOWER,
  ZONE.FULL_BODY,
];

/** Surface without ear/scalp — plate electro / UFF / amplipuls (head field still allowed). */
export const SURFACE_ELECTRO: PhysioZoneCode[] = SURFACE_ANATOMICAL.filter(
  (c) => c !== ZONE.EAR && c !== ZONE.SCALP,
);

/** MSK / ESWT — never cranial, not full-body “general”. */
export const SURFACE_ESWT: PhysioZoneCode[] = SURFACE_ANATOMICAL.filter(
  (c) =>
    c !== ZONE.HEAD &&
    c !== ZONE.SCALP &&
    c !== ZONE.FACE &&
    c !== ZONE.EAR &&
    c !== ZONE.FULL_BODY,
);

/**
 * Heart-sparing bath fill chips (yod-brom, hidromassage immersion).
 * Clinical: water ≤ nipple line, heart open, head+neck always above water.
 * Jet bans for hydromassage = nurse hint on the form, not S chips.
 */
export const HEART_SPARING_BATH: PhysioZoneCode[] = [ZONE.FULL_BODY, ZONE.TO_WAIST];

/** Naftalan bath chips: full body + sitz (♀/♂ schedule SKUs). */
export const BATH_FILL: PhysioZoneCode[] = [ZONE.FULL_BODY, ZONE.SITZ];

export const FOUR_CHAMBER_ONLY: PhysioZoneCode[] = [ZONE.FOUR_CHAMBER];
export const FULL_BODY_ONLY: PhysioZoneCode[] = [ZONE.FULL_BODY];

/** Paraffin aşağı — legs up to buttocks (not abdomen / Shcherbak panty). */
export const PARAFFIN_LEGS: PhysioZoneCode[] = [
  ZONE.LOWER_LIMB,
  ZONE.HIP_GLUTEAL,
  ZONE.KNEE,
  ZONE.ANKLE,
  ZONE.FOOT_LEG,
];

/** Paraffin yuxarı — upper limb family only. */
export const PARAFFIN_ARMS: PhysioZoneCode[] = [...UPPER];

export const PARAFFIN_COLLAR_BACK: PhysioZoneCode[] = [
  ...NECK_COLLAR,
  ZONE.BACK,
  ZONE.BACK_AND_LUMBAR,
  ZONE.CERVICOTHORACIC,
  ZONE.SPINE_FULL,
  ZONE.LUMBOSACRAL,
  ZONE.CHEST,
  ZONE.SHOULDER,
];

/** Lymph: doctor picks legs and/or abdomen; one procedure (always TOGETHER). */
export const LYMPH_DRAINAGE: PhysioZoneCode[] = [...LOWER, ZONE.ABDOMEN];

export const TURUNDA_SITES: PhysioZoneCode[] = [ZONE.FACE, ZONE.EAR];
export const PELVIC_URO: PhysioZoneCode[] = [
  ZONE.PANTIES,
  ZONE.LUMBOSACRAL,
  ZONE.HIP_GLUTEAL,
  ZONE.ABDOMEN,
  ZONE.COCCYX,
  ZONE.SITZ,
];

export function uniqueSiteCodes(codes: readonly string[]): string[] {
  return [...new Set(codes)];
}
