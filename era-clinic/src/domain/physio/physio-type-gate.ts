import type { PhysioOrderFieldCode } from "./physio-order-fields";
import {
  BATH_FILL,
  FOUR_CHAMBER_ONLY,
  FULL_BODY_ONLY,
  HEART_SPARING_BATH,
  LYMPH_DRAINAGE,
  PARAFFIN_ARMS,
  PARAFFIN_COLLAR_BACK,
  PARAFFIN_LEGS,
  PELVIC_URO,
  SURFACE_ANATOMICAL,
  SURFACE_ELECTRO,
  SURFACE_ESWT,
  TURUNDA_SITES,
  ZONE,
  uniqueSiteCodes,
} from "./physio-allowed-sites";

export type PhysioSitesHintKey = "hydro_jet_safety";

export type PhysioTypeGate = {
  needsSite: boolean;
  fields: PhysioOrderFieldCode[];
  /** PhysioSite.code allowlist. Empty when needsSite=false. */
  allowedSiteCodes: string[];
  /** When true, multi-site is one simultaneous application (hide TURN). */
  forceSiteTogether: boolean;
  /** Optional nurse/doctor hint under site chips. */
  sitesHintKey: PhysioSitesHintKey | null;
};

function foldHay(code: string, name: string): string {
  return `${code} ${name}`
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
}

function unique(fields: PhysioOrderFieldCode[]): PhysioOrderFieldCode[] {
  return [...new Set(fields)];
}

function sites(...lists: readonly (readonly string[])[]): string[] {
  return uniqueSiteCodes(lists.flat());
}

/**
 * SKU/name → needsSite + physioOrderFields + allowedSiteCodes + UI hints.
 * Field lists: WO reconcile + FO answers 2026-09-04.
 */
export function inferPhysioTypeGate(code: string, name = ""): PhysioTypeGate {
  const hay = foldHay(code, name);

  const noSite =
    /ozon|inqal|inhal|hidrokolon|karboksi|mikrokliz|infuz|fito.?terapiya|ginekoloji.?tampon|proloter/.test(
      hay,
    );

  if (noSite) {
    const fields: PhysioOrderFieldCode[] = [];
    if (/inqal|inhal/.test(hay)) fields.push("NO_ADDITIVE", "SUBSTANCE_OR_ADDITIVE");
    if (/hidrokolon/.test(hay) && /bitki|cay/.test(hay)) fields.push("SUBSTANCE_OR_ADDITIVE");
    return {
      needsSite: false,
      fields: unique(fields),
      allowedSiteCodes: [],
      forceSiteTogether: false,
      sitesHintKey: null,
    };
  }

  const fields: PhysioOrderFieldCode[] = [];
  // Immersion bath ♀/♂ — sit/full + cadence. Smear-without-immersion = separate SKU Aplikasiya.
  const isNaftalanImmersionBath =
    /naftalan/.test(hay) && /vanna/.test(hay) && !/4.?kamerali/.test(hay);
  const isAplikasiyaNaftalan = /aplikasiya/.test(hay) && /naftalan/.test(hay);
  const isIsiq = /isiq.?vann/.test(hay);
  const isInfraOrSollyuks = /infra|sollyuks|solyuks/.test(hay);

  const noOrderLaterality =
    isNaftalanImmersionBath ||
    /yod.?brom/.test(hay) ||
    /hidromasaj/.test(hay) ||
    /bukme/.test(hay) ||
    /4.?kamera/.test(hay) ||
    (/parafin/.test(hay) &&
      /butun|beden/.test(hay) &&
      !/asagi|yuxari|boyun|kurek/.test(hay));

  if (!noOrderLaterality) {
    fields.push("LATERALITY");
  }

  if (/amplipuls/.test(hay)) {
    fields.push(
      "AMPLIPULS_WORK_KIND",
      "ELECTRODE_COUNT",
      "DEVICE_PROGRAM",
      "APPLICATION_SURFACE",
      "DEVICE_PARAMS",
      "SPINE_LEVEL",
    );
  }
  if (/elektroforez|elektroterapiya|unistim/.test(hay)) {
    fields.push(
      "SUBSTANCE_OR_ADDITIVE",
      "ELECTRODE_COUNT",
      "DEVICE_PROGRAM",
      "SPINE_LEVEL",
      "DEVICE_PARAMS",
      "APPLICATION_SURFACE",
      "INTENSITY",
    );
  }
  if (/ultrafonoforez/.test(hay)) {
    fields.push(
      "SUBSTANCE_OR_ADDITIVE",
      "EXTRA_OIL",
      "DEVICE_PARAMS",
      "APPLICATION_SURFACE",
      "DEVICE_PROGRAM",
      "INTENSITY",
    );
  }
  if (/parafin/.test(hay)) {
    // FO 2026-09-04: DAY_BLOCK only on naftalan family (not paraffin).
    fields.push("HOLD_OR_STOP", "APPLICATION_SURFACE", "SPINE_LEVEL");
  }
  if (/darsonval/.test(hay)) {
    fields.push("APPLICATION_SURFACE", "HOLD_OR_STOP", "INTENSITY", "DEVICE_PARAMS");
  }
  if (isNaftalanImmersionBath) {
    fields.push("NAFTALAN_FILL", "BATH_SEQUENCE", "DAY_BLOCK");
  }
  if (isAplikasiyaNaftalan) {
    // Paid smear ♀/♂ — body parts or full; same cadence chips as baths; shares bath cabins
    fields.push("SUBSTANCE_OR_ADDITIVE", "APPLICATION_SURFACE", "DAY_BLOCK");
  }
  // 4-chamber naftalan: limbs in cells — smear-without-immersion is Aplikasiya SKU, not a flag here.
  if (/4.?kamerali/.test(hay) && /hidroqalvan|hidro.?qalvan|galvan/.test(hay)) {
    fields.push("SUBSTANCE_OR_ADDITIVE");
  }
  if (/massaj|masaj|manual.?terapi|osteopat/.test(hay)) {
    fields.push("INTENSITY", "HOLD_OR_STOP", "APPLICATION_SURFACE", "DEVICE_PARAMS");
  }
  if (/lazer|maqnit|super.?inductive|zerbe|vakuum/.test(hay)) {
    fields.push("DEVICE_PROGRAM", "DEVICE_PARAMS", "APPLICATION_SURFACE");
  }
  if (isInfraOrSollyuks) {
    // FO 2026-09-04: lamp + naftalan oil on skin is routine → substance + extra oil on order
    fields.push(
      "SUBSTANCE_OR_ADDITIVE",
      "EXTRA_OIL",
      "DEVICE_PROGRAM",
      "DEVICE_PARAMS",
      "APPLICATION_SURFACE",
    );
  }
  if (isIsiq) {
    // FO: smear naftalan then light cabin; WO picks body sites (not intensity)
    fields.push("SUBSTANCE_OR_ADDITIVE", "EXTRA_OIL", "APPLICATION_SURFACE");
  }
  if (/lazer|maqnit/.test(hay)) {
    fields.push("SPINE_LEVEL", "HOLD_OR_STOP", "INTENSITY");
  }
  if (/turunda/.test(hay)) {
    fields.push("SUBSTANCE_OR_ADDITIVE", "EXTRA_OIL");
  }
  if (/limfodrenaj/.test(hay)) {
    fields.push("APPLICATION_SURFACE");
  }
  if (/xallar|koaqul/.test(hay)) {
    fields.push("APPLICATION_SURFACE", "DEVICE_PARAMS");
  }
  if (/yod.?brom|hidromasaj|ufb|bukme/.test(hay)) {
    fields.push("INTENSITY");
  }
  if (/ufb/.test(hay)) {
    fields.push("DEVICE_PARAMS", "DEVICE_PROGRAM", "APPLICATION_SURFACE");
  }
  if (/qisa.?dalga|uvc|short.?wave/.test(hay)) {
    fields.push("APPLICATION_SURFACE", "DEVICE_PROGRAM", "DEVICE_PARAMS");
  }
  if (/traksiya|triqqezon|trigger/.test(hay)) {
    fields.push("INTENSITY", "HOLD_OR_STOP", "APPLICATION_SURFACE");
  }

  return {
    needsSite: true,
    fields: unique(fields),
    allowedSiteCodes: inferAllowedSites(hay),
    forceSiteTogether: /limfodrenaj/.test(hay),
    sitesHintKey: /hidromasaj/.test(hay) ? "hydro_jet_safety" : null,
  };
}

/** Per-SKU allowlists — FO clinical rules 2026-09 + Nafta package anatomy. */
function inferAllowedSites(hay: string): string[] {
  if (/4.?kamera/.test(hay)) return sites(FOUR_CHAMBER_ONLY);

  if (/parafin/.test(hay)) {
    if (/butun|beden/.test(hay) && !/asagi|yuxari|boyun|kurek/.test(hay)) {
      return sites(FULL_BODY_ONLY);
    }
    if (/asagi/.test(hay)) return sites(PARAFFIN_LEGS);
    if (/yuxari/.test(hay)) return sites(PARAFFIN_ARMS);
    if (/boyun|kurek/.test(hay)) return sites(PARAFFIN_COLLAR_BACK);
    return sites(FULL_BODY_ONLY);
  }

  if (/naftalan/.test(hay) && /vanna/.test(hay)) return sites(BATH_FILL);

  // Aplikasiya ♀/♂ — anatomical (not sit/full bath chips); shares ♀/♂ bath cabins in schedule
  if (/aplikasiya/.test(hay) && /naftalan/.test(hay)) return sites(SURFACE_ANATOMICAL);
  if (/infra|sollyuks|solyuks|isiq.?vann/.test(hay)) return sites(SURFACE_ANATOMICAL);

  if (/turunda.?qulaq|trunda.?qulaq/.test(hay) && !/burun/.test(hay)) {
    return sites([ZONE.EAR]);
  }
  if (/turunda.?burun|trunda.?burun/.test(hay) && !/qulaq/.test(hay)) {
    return sites([ZONE.FACE]);
  }
  // Combined turunda SKU retired for new orders — legacy name still face+ear if imported
  if (/turunda|trunda/.test(hay)) return sites(TURUNDA_SITES);

  if (/limfodrenaj/.test(hay)) return sites(LYMPH_DRAINAGE);

  if (/uroloji.?vibro|vibro.?lazer/.test(hay)) return sites(PELVIC_URO);

  if (/yod.?brom/.test(hay)) return sites(HEART_SPARING_BATH);

  // Hidromasaj = jacuzzi plain water (FO); same immersion chips as before
  if (/hidromasaj/.test(hay)) return sites(HEART_SPARING_BATH);

  if (/bukme/.test(hay)) return sites(FULL_BODY_ONLY);

  if (/zerbe|eswt|sok.?dalga|shock.?wave/.test(hay)) return sites(SURFACE_ESWT);

  if (/amplipuls|elektroforez|elektroterapiya|unistim|ultrafonoforez/.test(hay)) {
    return sites(SURFACE_ELECTRO);
  }

  if (/traksiya|triqqezon|trigger|manual.?terapi|osteopat/.test(hay)) {
    return sites(SURFACE_ANATOMICAL);
  }

  return sites(SURFACE_ANATOMICAL);
}
