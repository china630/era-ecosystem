/** UI toast under `patientCard.*` for day-1 package open result. */

export type Day1ProgramClientResult =
  | { opened: true; programCode?: string }
  | {
      opened: false;
      reason?: string;
      programCode?: string;
      nights?: number;
      minNights?: number;
    }
  | null
  | undefined;

export type Day1Toast =
  | { tone: "success"; key: "day1ProgramOpened" }
  | { tone: "error"; key: "day1NoProgramCode" }
  | {
      tone: "error";
      key: "day1PackageNightsBelowMin";
      values: { code: string; nights: number; minNights: number };
    }
  | { tone: "error"; key: "day1TemplateNotFound"; values: { code: string } }
  | { tone: "error"; key: "day1InstantiateFailed" };

/**
 * Surface only actionable outcomes. Incomplete gates (no anamnesis yet, etc.) stay silent.
 */
export function day1ProgramToast(
  result: Day1ProgramClientResult,
): Day1Toast | null {
  if (!result) return null;
  if (result.opened) return { tone: "success", key: "day1ProgramOpened" };
  if (result.reason === "NO_PROGRAM_CODE") {
    return { tone: "error", key: "day1NoProgramCode" };
  }
  if (result.reason === "PACKAGE_NIGHTS_BELOW_MIN") {
    const nights = Number(result.nights);
    const minNights = Number(result.minNights);
    if (Number.isFinite(nights) && Number.isFinite(minNights)) {
      return {
        tone: "error",
        key: "day1PackageNightsBelowMin",
        values: {
          code: result.programCode?.trim() || "—",
          nights,
          minNights,
        },
      };
    }
  }
  if (result.reason === "TEMPLATE_NOT_FOUND") {
    return {
      tone: "error",
      key: "day1TemplateNotFound",
      values: { code: result.programCode?.trim() || "—" },
    };
  }
  if (result.reason === "INSTANTIATE_FAILED") {
    return { tone: "error", key: "day1InstantiateFailed" };
  }
  return null;
}

/** @deprecated use day1ProgramToast — kept for older call sites that only need a key. */
export function day1ProgramToastKey(
  result: Day1ProgramClientResult,
): Day1Toast["key"] | null {
  return day1ProgramToast(result)?.key ?? null;
}
