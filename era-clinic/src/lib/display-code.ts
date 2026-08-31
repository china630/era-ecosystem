/** Ops display: "Name (CODE)". Falls back to code when name is empty. */
export function formatNameAndCode(
  name: string | null | undefined,
  code: string | null | undefined,
): string {
  const n = (name ?? "").trim();
  const c = (code ?? "").trim();
  if (n && c) return `${n} (${c})`;
  if (n) return n;
  return c || "—";
}
