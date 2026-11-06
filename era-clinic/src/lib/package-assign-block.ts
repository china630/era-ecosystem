type BlockTranslator = (
  key:
    | "packageAssignNoProgram"
    | "packageAssignNoProgramCode"
    | "packageAssignNoAnamnesis"
    | "packageAssignNoComplaint"
    | "packageAssignNoDiagnosis"
    | "packageAssignNoCareTeam"
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
