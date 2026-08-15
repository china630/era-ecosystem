/** Stable payroll component codes (former Prisma enum PayrollComponentCode). */
export const PayrollComponentCode = {
  BONUS: "BONUS",
  MATERIAL_AID: "MATERIAL_AID",
  ALIMONY: "ALIMONY",
  EXECUTION_SHEET: "EXECUTION_SHEET",
  LOAN: "LOAN",
  ADVANCE: "ADVANCE",
  UNION_DUE: "UNION_DUE",
  INCOME_TAX_RELIEF: "INCOME_TAX_RELIEF",
  NIGHT_PREMIUM: "NIGHT_PREMIUM",
  EVENING_PREMIUM: "EVENING_PREMIUM",
  OVERTIME_PREMIUM: "OVERTIME_PREMIUM",
  BASE_SALARY: "BASE_SALARY",
} as const;

export type PayrollComponentCode =
  (typeof PayrollComponentCode)[keyof typeof PayrollComponentCode];

export const PAYROLL_COMPONENT_CODES = Object.values(PayrollComponentCode);
