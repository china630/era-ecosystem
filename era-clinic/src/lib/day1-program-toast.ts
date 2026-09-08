/** UI toast keys under `patientCard.*` for day-1 package open result. */
export type Day1ProgramClientResult =
  | { opened: true; programCode?: string }
  | { opened: false; reason?: string }
  | null
  | undefined;

/**
 * Surface only actionable outcomes. Incomplete gates (no anamnesis yet, etc.) stay silent.
 */
export function day1ProgramToastKey(
  result: Day1ProgramClientResult,
): "day1ProgramOpened" | "day1NoProgramCode" | "day1InstantiateFailed" | null {
  if (!result) return null;
  if (result.opened) return "day1ProgramOpened";
  if (result.reason === "NO_PROGRAM_CODE") return "day1NoProgramCode";
  if (result.reason === "INSTANTIATE_FAILED") return "day1InstantiateFailed";
  return null;
}
