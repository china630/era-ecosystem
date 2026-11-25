import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED =
  "SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED" as const;

/** Wave 1 stubs — emit in later waves; no Finance consumers required in Wave 1. */
export const SATELLITE_CONSTRUCTION_DOCUMENT_REVISION_PUBLISHED =
  "SATELLITE_CONSTRUCTION_DOCUMENT_REVISION_PUBLISHED" as const;
export const SATELLITE_CONSTRUCTION_ISSUE_CREATED =
  "SATELLITE_CONSTRUCTION_ISSUE_CREATED" as const;
export const SATELLITE_CONSTRUCTION_ISSUE_CLOSED =
  "SATELLITE_CONSTRUCTION_ISSUE_CLOSED" as const;
export const SATELLITE_CONSTRUCTION_RFI_ANSWERED =
  "SATELLITE_CONSTRUCTION_RFI_ANSWERED" as const;
export const SATELLITE_CONSTRUCTION_RFI_OVERDUE =
  "SATELLITE_CONSTRUCTION_RFI_OVERDUE" as const;
export const SATELLITE_CONSTRUCTION_SUBMITTAL_STATUS_CHANGED =
  "SATELLITE_CONSTRUCTION_SUBMITTAL_STATUS_CHANGED" as const;
export const SATELLITE_CONSTRUCTION_DAILY_LOG_SUBMITTED =
  "SATELLITE_CONSTRUCTION_DAILY_LOG_SUBMITTED" as const;
export const SATELLITE_CONSTRUCTION_INSPECTION_FAILED =
  "SATELLITE_CONSTRUCTION_INSPECTION_FAILED" as const;
export const SATELLITE_CONSTRUCTION_CHANGE_REQUEST_APPROVED_OPS =
  "SATELLITE_CONSTRUCTION_CHANGE_REQUEST_APPROVED_OPS" as const;
export const SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED =
  "SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED" as const;

/** Ops change approved — Finance may draft a ContractAmendment (no auto-GL). */
export const satelliteConstructionChangeRequestApprovedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CONSTRUCTION_CHANGE_REQUEST_APPROVED_OPS),
    payload: z.object({
      projectId: z.string(),
      entityId: z.string().optional(),
      changeRequestId: z.string().optional(),
      financeContractId: z.string().optional(),
      amountLimitDelta: z.number().optional(),
      description: z.string().optional(),
    }),
  });

export type SatelliteConstructionChangeRequestApprovedEvent = z.infer<
  typeof satelliteConstructionChangeRequestApprovedSchema
>;

export function isSatelliteConstructionChangeRequestApproved(
  data: unknown,
): data is SatelliteConstructionChangeRequestApprovedEvent {
  return satelliteConstructionChangeRequestApprovedSchema.safeParse(data)
    .success;
}

/** Ops SOV line on the progress act (not a Finance ledger row). */
export const satelliteConstructionProgressActLineSchema = z.object({
  itemCode: z.string().min(1),
  description: z.string().min(1),
  qty: z.number(),
  amountNet: z.number(),
  boqLineId: z.string().optional(),
});

export const satelliteConstructionProgressActSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED),
    payload: z.object({
      projectId: z.string(),
      actId: z.string(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
      periodKey: z.string().optional(),
      /** Optional Finance commercial contract id (ref only). */
      contractId: z.string().optional(),
      lines: z.array(satelliteConstructionProgressActLineSchema).optional(),
    }),
  });

export type SatelliteConstructionProgressActEvent = z.infer<
  typeof satelliteConstructionProgressActSchema
>;

export function isSatelliteConstructionProgressActApproved(
  data: unknown,
): data is SatelliteConstructionProgressActEvent {
  return satelliteConstructionProgressActSchema.safeParse(data).success;
}

/** Approved five-level estimate baseline — Finance may seed/sync Contract SOV (no auto-GL). */
export const satelliteConstructionEstimatePackageApprovedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED),
    payload: z.object({
      projectId: z.string(),
      packageId: z.string(),
      version: z.number().int().positive(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
      financeContractId: z.string().optional(),
      lineCount: z.number().int().nonnegative().optional(),
      lines: z
        .array(
          z.object({
            itemCode: z.string().min(1),
            description: z.string().min(1),
            qty: z.number(),
            amountNet: z.number(),
          }),
        )
        .optional(),
    }),
  });

export type SatelliteConstructionEstimatePackageApprovedEvent = z.infer<
  typeof satelliteConstructionEstimatePackageApprovedSchema
>;

export function isSatelliteConstructionEstimatePackageApproved(
  data: unknown,
): data is SatelliteConstructionEstimatePackageApprovedEvent {
  return satelliteConstructionEstimatePackageApprovedSchema.safeParse(data)
    .success;
}

/** Stub envelope for Wave 1+ event catalog (payload shape filled when emitters land). */
export const satelliteConstructionStubEventSchema = satelliteEventBaseSchema.extend({
  type: z.enum([
    SATELLITE_CONSTRUCTION_DOCUMENT_REVISION_PUBLISHED,
    SATELLITE_CONSTRUCTION_ISSUE_CREATED,
    SATELLITE_CONSTRUCTION_ISSUE_CLOSED,
    SATELLITE_CONSTRUCTION_RFI_ANSWERED,
    SATELLITE_CONSTRUCTION_RFI_OVERDUE,
    SATELLITE_CONSTRUCTION_SUBMITTAL_STATUS_CHANGED,
    SATELLITE_CONSTRUCTION_DAILY_LOG_SUBMITTED,
    SATELLITE_CONSTRUCTION_INSPECTION_FAILED,
    SATELLITE_CONSTRUCTION_CHANGE_REQUEST_APPROVED_OPS,
    SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED,
  ]),
  payload: z.object({
    projectId: z.string(),
    entityId: z.string().optional(),
  }),
});
