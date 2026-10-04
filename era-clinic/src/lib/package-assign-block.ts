type BlockTranslator = (
  key:
    | "packageAssignNoProgram"
    | "packageAssignNoProgramCode"
    | "packageAssignNoAnamnesis"
    | "packageAssignNoComplaint"
    | "packageAssignNoCareTeam"
    | "packageAssignInstantiateFailed",
  values?: { code: string },
) => string;

/** Localized reason when package balances cannot open. */
export function packageAssignBlockText(
  t: BlockTranslator,
  code: string | null | undefined,
  packageCode?: string | null,
): string | null {
  switch (code) {
    case "NO_PROGRAM_CODE":
      return t("packageAssignNoProgramCode");
    case "NO_ANAMNESIS":
      return t("packageAssignNoAnamnesis");
    case "NO_COMPLAINT":
      return t("packageAssignNoComplaint");
    case "NO_CARE_TEAM":
      return t("packageAssignNoCareTeam");
    case "INSTANTIATE_FAILED":
      return t("packageAssignInstantiateFailed", { code: packageCode ?? "" });
    case "NO_PROGRAM":
      return t("packageAssignNoProgram");
    default:
      return null;
  }
}
