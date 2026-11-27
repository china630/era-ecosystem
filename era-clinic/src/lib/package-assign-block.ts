type BlockTranslator = (
  key:
    | "packageAssignNoProgram"
    | "packageAssignNoProgramCode"
    | "packageAssignNoAnamnesis"
    | "packageAssignNoComplaint"
    | "packageAssignNoDiagnosis"
    | "packageAssignNoCareTeam"
    | "packageAssignEpisodeScope"
    | "packageAssignInstantiateFailed"
    | "packageAssignTemplateNotFound"
    | "packageAssignNightsBelowMin",
  values?: { code: string; nights?: number; minNights?: number },
) => string;

export type PackageAssignBlockDetail = {
  nights?: number | null;
  minNights?: number | null;
  /** Original instantiate error. Shown instead of the generic template hint. */
  message?: string | null;
};

/** Map API mutation gate codes onto soft blockReason used by the assign modal. */
export function normalizeAssignGateBlock(
  code: string | null | undefined,
):
  | "NO_ANAMNESIS"
  | "NO_COMPLAINT"
  | "NO_DIAGNOSIS"
  | "NO_CARE_TEAM"
  | null {
  if (!code) return null;
  if (code === "ANAMNESIS_REQUIRED" || code === "NO_ANAMNESIS") return "NO_ANAMNESIS";
  if (code === "COMPLAINT_REQUIRED" || code === "NO_COMPLAINT") return "NO_COMPLAINT";
  if (code === "DIAGNOSIS_REQUIRED" || code === "NO_DIAGNOSIS") return "NO_DIAGNOSIS";
  if (code === "CARE_TEAM_REQUIRED" || code === "NO_CARE_TEAM") return "NO_CARE_TEAM";
  return null;
}

/**
 * Care-team scope 404 and clinical lane gates → localized copy.
 * Returns null when the code is unrelated (caller keeps its own mapping).
 */
export function packageAssignScopeOrGateText(
  t: BlockTranslator,
  code: string | null | undefined,
  serverError?: string | null,
): string | null {
  const err = (serverError ?? "").trim();
  if (code === "EPISODE_SCOPE" || err === "Episode not found") {
    return t("packageAssignEpisodeScope");
  }
  const gate = normalizeAssignGateBlock(code);
  if (!gate) return null;
  return packageAssignBlockText(t, gate);
}

/** Localized reason when package balances cannot open. */
export function packageAssignBlockText(
  t: BlockTranslator,
  code: string | null | undefined,
  packageCode?: string | null,
  detail?: PackageAssignBlockDetail | null,
): string | null {
  const pin = packageCode ?? "";
  switch (code) {
    case "NO_PROGRAM_CODE":
      return t("packageAssignNoProgramCode");
    case "NO_ANAMNESIS":
      return t("packageAssignNoAnamnesis");
    case "NO_COMPLAINT":
      return t("packageAssignNoComplaint");
    case "NO_DIAGNOSIS":
      return t("packageAssignNoDiagnosis");
    case "NO_CARE_TEAM":
      return t("packageAssignNoCareTeam");
    case "PACKAGE_NIGHTS_BELOW_MIN": {
      const nights = detail?.nights;
      const minNights = detail?.minNights;
      if (
        typeof nights === "number" &&
        Number.isFinite(nights) &&
        typeof minNights === "number" &&
        Number.isFinite(minNights)
      ) {
        return t("packageAssignNightsBelowMin", { code: pin, nights, minNights });
      }
      return t("packageAssignInstantiateFailed", { code: pin });
    }
    case "TEMPLATE_NOT_FOUND":
      return t("packageAssignTemplateNotFound", { code: pin });
    case "INSTANTIATE_FAILED":
      if (detail?.message?.trim()) return detail.message.trim();
      return t("packageAssignInstantiateFailed", { code: pin });
    case "NO_PROGRAM":
      return t("packageAssignNoProgram");
    default:
      return null;
  }
}
