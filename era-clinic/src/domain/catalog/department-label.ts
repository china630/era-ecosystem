export type DepartmentNames = {
  code: string;
  nameAz?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
};

/** UI-locale name, then any filled translation, then the code. */
export function localizedDepartmentName(row: DepartmentNames, locale: string): string {
  const lang = locale.toLowerCase().startsWith("ru")
    ? "ru"
    : locale.toLowerCase().startsWith("en")
      ? "en"
      : "az";
  const pick = lang === "ru" ? row.nameRu : lang === "en" ? row.nameEn : row.nameAz;
  return (
    pick?.trim() ||
    row.nameAz?.trim() ||
    row.nameRu?.trim() ||
    row.nameEn?.trim() ||
    row.code
  );
}
