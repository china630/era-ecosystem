import { z } from "zod";

/**
 * Bump when e-müqavilə portal field mapping / selectors change.
 * Must stay in sync across Finance API, extension, and prefill DTO.
 */
export const EMAS_FIELD_MAPPING_VERSION = 1;

/**
 * Minimal DTO for ƏMAS e-müqavilə prefill from ERP.
 * Field names are portal-agnostic; connector maps to DOM selectors.
 */
export const EmployeeContractPrefillSchema = z.object({
  employeeId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  finCode: z.string().nullable(),
  positionTitle: z.string().nullable(),
  departmentName: z.string().nullable(),
  /** Gross monthly salary in AZN (string for portal decimal fields). Contract salary — never internalRate. */
  salaryGrossAzn: z.string().nullable(),
  contractStartDate: z.string().nullable(),
  contractEndDate: z.string().nullable().optional(),
  /** Optional contract / document id in ERP for audit correlation. */
  contractId: z.string().optional(),
  /** Wave 7: PENDING_FIN | PENDING_SALARY | READY — extension refuses fill unless READY. */
  emasStatus: z.enum(["PENDING_FIN", "PENDING_SALARY", "READY"]).optional(),
  /** Wave 7: must match extension EMAS_FIELD_MAPPING_VERSION when present. */
  mappingVersion: z.number().int().positive().optional(),
  message: z.string().optional(),
});

export type EmployeeContractPrefill = z.infer<
  typeof EmployeeContractPrefillSchema
>;

export const PrefillRequestSchema = z.object({
  organizationId: z.string(),
  employeeId: z.string(),
});

export type PrefillRequest = z.infer<typeof PrefillRequestSchema>;
