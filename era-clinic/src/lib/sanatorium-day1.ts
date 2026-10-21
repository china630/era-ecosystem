/**
 * Exam/intake sort so a FIFO prefix is clinical work first.
 * The daily free cap is per package block, not a clinic-wide count of 3.
 */

/** Exam / intake codes sorted ahead of treatment so FIFO prefix is day-1 clinical work. */
export const EXAM_PREFIX_RE =
  /^(THERAPIST|NEURO|GYN|URO|ECG|USG|ECHO|LAB|INTAKE|DOCTOR|CHECKUP|PKG-NAFTA-INTAKE|CONSULT)/i;

export function isExamPrefixCode(procedureCode: string): boolean {
  return EXAM_PREFIX_RE.test(procedureCode);
}

export function sortLinesExamPrefixFirst<T extends { procedureCode: string }>(
  lines: T[],
): T[] {
  return [...lines].sort((a, b) => {
    const ae = isExamPrefixCode(a.procedureCode) ? 0 : 1;
    const be = isExamPrefixCode(b.procedureCode) ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.procedureCode.localeCompare(b.procedureCode);
  });
}
