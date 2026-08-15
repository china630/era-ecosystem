import { PayrollComponentCode } from "@erafinance/database";

export { PayrollComponentCode };

/** Closed list for DTO validation / OpenAPI (mirrors Prisma enum). */
export const PAYROLL_COMPONENT_CODES = Object.values(
  PayrollComponentCode,
) as PayrollComponentCode[];
