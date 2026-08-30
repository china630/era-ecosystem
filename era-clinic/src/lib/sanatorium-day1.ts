/**
 * Wave C — doctor first-day confirm helpers (pure).
 * Soft warn only; FIFO gates stay in sanatorium-fifo-gates.ts.
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

/** Nafta default soft cap: first confirm batch >3 warns; never hard-blocks. */
export const DAY1_SOFT_CONFIRM_CAP = 3;

export function day1ConfirmSoftWarn(orderIdsLength: number): string | null {
  if (orderIdsLength > DAY1_SOFT_CONFIRM_CAP) {
    return `Day-1 soft cap: Nafta default is ${DAY1_SOFT_CONFIRM_CAP} procedures; batch has ${orderIdsLength}`;
  }
  return null;
}

/**
 * Same-day 4th+ in-package procedure: when `sameDayOtherActiveCount >= 3`,
 * this completion is the 4th+ and should charge list price without burning knot.
 */
export function isSameDayFourthOrLater(sameDayOtherActiveCount: number): boolean {
  return sameDayOtherActiveCount >= DAY1_SOFT_CONFIRM_CAP;
}
