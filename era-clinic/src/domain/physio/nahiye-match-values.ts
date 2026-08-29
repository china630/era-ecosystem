import { fold, indexWhole } from "./nahiye-match";
import type { PhysioLateralityCode, PhysioOrderFields } from "./physio-order-fields";

export type ListAliasHit = { id: string; listKind: "DEVICE_PROGRAM" | "SUBSTANCE"; aliasFold: string };

/** LEFT/RIGHT/BOTH from the original nahiye (flag LATERALITY only says it was present). */
export function inferLateralityFromText(raw: string): PhysioLateralityCode | null {
  const n = fold(raw);
  if (indexWhole(n, "her iki") >= 0 || indexWhole(n, "hir iki") >= 0 || indexWhole(n, "her ikisine") >= 0) {
    return "BOTH";
  }
  if (indexWhole(n, "sol") >= 0) return "LEFT";
  if (indexWhole(n, "sag") >= 0) return "RIGHT";
  return null;
}

function firstWhole(n: string, needles: string[]): boolean {
  return needles.some((x) => indexWhole(n, x) >= 0);
}

export function physioFieldsFromFlags(
  flags: string[],
  rawNahiye: string,
  listHits: ListAliasHit[],
): PhysioOrderFields {
  const n = fold(rawNahiye);
  const out: PhysioOrderFields = {};
  const has = (code: string) => flags.includes(code);

  if (has("AMPLIPULS_WORK_KIND")) {
    if (firstWhole(n, ["4 cu", "4 cu rej", "4- rej", "4ci", "iv"])) out.amplipulsWorkKind = "IV";
    else if (firstWhole(n, ["3 cu", "3ci", "iii"])) out.amplipulsWorkKind = "III";
    else if (firstWhole(n, ["2 ci", "2ci", "ii"])) out.amplipulsWorkKind = "II";
    else if (firstWhole(n, ["5 ci", "5ci", "v"])) out.amplipulsWorkKind = "V";
    else if (firstWhole(n, ["1 ci", "1ci"])) out.amplipulsWorkKind = "I";
  }
  if (has("ELECTRODE_COUNT")) {
    if (firstWhole(n, ["4 lu", "4 lu rejim", "4 lü", "4 basliqli", "4 basliqli"])) out.electrodeCount = "4";
    else if (firstWhole(n, ["2 li", "iki basligi", "2 li rejim"])) out.electrodeCount = "2";
  }
  if (has("NO_ADDITIVE")) out.noAdditive = true;
  if (has("EXTRA_OIL")) out.extraOil = true;
  if (has("HOLD_OR_STOP")) out.holdOrStop = true;
  if (has("SMEAR")) out.smear = true;
  if (has("BATH_SEQUENCE")) out.bathSequence = "SITZ_THEN_FULL";
  // Single-fill naftalan (not multi-day sequence): tam | oturaq | qurşaq.
  if (!out.bathSequence) {
    if (firstWhole(n, ["tam", "tam beden", "tan beden", "tam bedn"])) out.naftalanFill = "TAM";
    else if (firstWhole(n, ["oturaq", "otraq", "3oturaq", "3 oturaq"])) out.naftalanFill = "OTURAQ";
    else if (firstWhole(n, ["qursaq", "qursaga kimi", "qursaga qeder", "qursagaqeder"])) {
      out.naftalanFill = "QURSAQ";
    }
  }
  if (has("APPLICATION_SURFACE")) {
    if (firstWhole(n, ["on ve arxa", "on ve arxa", "front"])) out.applicationSurface = "FRONT_BACK";
    else if (firstWhole(n, ["yuxari hisse", "yuxari"])) out.applicationSurface = "UPPER";
    else if (firstWhole(n, ["asagi hissesi", "asagi hisse"])) out.applicationSurface = "LOWER";
  }
  if (has("INTENSITY")) {
    if (firstWhole(n, ["isti olmasin", "isti olmasin"])) out.intensity = "NOT_HOT";
    else if (firstWhole(n, ["yungul"])) out.intensity = "LIGHT";
    else if (firstWhole(n, ["zeif"])) out.intensity = "WEAK";
  }
  if (has("DAY_BLOCK")) {
    if (firstWhole(n, ["gunasiri", "guna siri"])) out.dayBlock = "ALTERNATING";
    else if (firstWhole(n, ["5 gun ardindan", "5 gun"])) out.dayBlock = "5";
    else if (firstWhole(n, ["3 gun"])) out.dayBlock = "3";
  }
  if (has("SPINE_LEVEL")) {
    const levels = ["l4 l5", "l5 s1", "l1 l5", "c3 c4 c5", "c3 c4", "c4 c5", "c5 c6", "c6 c7"];
    const map: Record<string, PhysioOrderFields["spineLevel"]> = {
      "l4 l5": "L4-L5",
      "l5 s1": "L5-S1",
      "l1 l5": "L1-L5",
      "c3 c4 c5": "C3-C5",
      "c3 c4": "C3-C4",
      "c4 c5": "C4-C5",
      "c5 c6": "C5-C6",
      "c6 c7": "C6-C7",
    };
    for (const token of levels) {
      if (indexWhole(n, token) >= 0) {
        out.spineLevel = map[token] ?? null;
        break;
      }
    }
  }
  if (has("DEVICE_PARAMS")) {
    if (firstWhole(n, ["1 mhz"])) out.deviceParam = "FREQ_1_MHZ";
    else if (firstWhole(n, ["3 mhz"])) out.deviceParam = "FREQ_3_MHZ";
    else if (firstWhole(n, ["kesikli"])) out.deviceParam = "PULSED";
  }

  const programs = listHits
    .filter((h) => h.listKind === "DEVICE_PROGRAM")
    .sort((a, b) => b.aliasFold.length - a.aliasFold.length);
  const substances = listHits
    .filter((h) => h.listKind === "SUBSTANCE")
    .sort((a, b) => b.aliasFold.length - a.aliasFold.length);
  if (has("DEVICE_PROGRAM")) {
    const hit = programs.find((h) => indexWhole(n, h.aliasFold) >= 0);
    if (hit) out.deviceProgramId = hit.id;
  }
  if (has("SUBSTANCE_OR_ADDITIVE")) {
    const hit = substances.find((h) => indexWhole(n, h.aliasFold) >= 0);
    if (hit) out.substanceId = hit.id;
  }
  return out;
}

export function siteApplyModeFromFlags(flags: string[]): "TURN" | "TOGETHER" | null {
  if (flags.includes("SEQUENCE_ALTERNATING")) return "TURN";
  if (flags.includes("SEQUENCE_SIMULTANEOUS")) return "TOGETHER";
  return null;
}
