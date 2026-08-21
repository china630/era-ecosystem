/** Pure print-form gates (AC-CLI-PRINT). */

export function printDocumentDenied(input: {
  entityFound: boolean;
  lang?: string | null;
}): string | null {
  if (!input.entityFound) return "Print source not found";
  if (input.lang != null && input.lang !== "" && !["az", "ru", "en"].includes(input.lang)) {
    return "Unsupported print language";
  }
  return null;
}
