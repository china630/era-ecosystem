import type { PhysioOrderFieldCode } from "./physio-order-fields";

export type PhysioTypeGate = {
  needsSite: boolean;
  fields: PhysioOrderFieldCode[];
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

/**
 * SKU/name → needsSite + physioOrderFields. SatAdmin may override after seed.
 * Empty nahiye defaults (canon §5) stay W4 import; this only gates the doctor form.
 */
export function inferPhysioTypeGate(code: string, name = ""): PhysioTypeGate {
  const hay = foldHay(code, name);

  const noSite =
    /ozon|inqal|inhal|hidrokolon|karboksi|mikrokliz|infuz|fito.?terapiya/.test(hay);

  if (noSite) {
    const fields: PhysioOrderFieldCode[] = [];
    if (/inqal|inhal/.test(hay)) fields.push("NO_ADDITIVE", "SUBSTANCE_OR_ADDITIVE");
    if (/hidrokolon/.test(hay) && /bitki|cay/.test(hay)) fields.push("SUBSTANCE_OR_ADDITIVE");
    return { needsSite: false, fields: unique(fields) };
  }

  const fields: PhysioOrderFieldCode[] = ["LATERALITY"];

  if (/amplipuls/.test(hay)) {
    fields.push("AMPLIPULS_WORK_KIND", "ELECTRODE_COUNT");
  }
  if (/elektroforez|elektroterapiya|unistim/.test(hay)) {
    fields.push("SUBSTANCE_OR_ADDITIVE", "ELECTRODE_COUNT", "DEVICE_PROGRAM");
  }
  if (/ultrafonoforez/.test(hay)) {
    fields.push("SUBSTANCE_OR_ADDITIVE", "EXTRA_OIL", "DEVICE_PARAMS");
  }
  if (/parafin/.test(hay)) {
    fields.push("DAY_BLOCK", "HOLD_OR_STOP", "APPLICATION_SURFACE", "SPINE_LEVEL");
  }
  if (/darsonval/.test(hay)) {
    fields.push("DAY_BLOCK", "APPLICATION_SURFACE");
  }
  if (/naftalan/.test(hay) && /vanna/.test(hay) && !/4.?kamerali/.test(hay)) {
    // BATH_SEQUENCE = multi-day sitz→full; NAFTALAN_FILL = single fill (tam|oturaq|qurşaq).
    fields.push("BATH_SEQUENCE", "SMEAR", "NAFTALAN_FILL");
  }
  if (/massaj|masaj/.test(hay)) {
    fields.push("INTENSITY", "HOLD_OR_STOP", "APPLICATION_SURFACE");
  }
  if (/lazer|infra|maqnit|super.?inductive|zerbe|vakuum|sollyuks|solyuks/.test(hay)) {
    fields.push("DEVICE_PROGRAM", "DEVICE_PARAMS", "APPLICATION_SURFACE");
  }
  if (/turunda/.test(hay)) {
    fields.push("SUBSTANCE_OR_ADDITIVE");
  }
  if (/limfodrenaj/.test(hay)) {
    fields.push("APPLICATION_SURFACE");
  }
  if (/yod.?brom|hidromasaj|ufb|bukme/.test(hay)) {
    fields.push("INTENSITY");
  }

  return { needsSite: true, fields: unique(fields) };
}
