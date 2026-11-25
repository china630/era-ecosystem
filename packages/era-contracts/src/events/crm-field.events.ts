import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_CRM_LEAD_CONVERTED =
  "SATELLITE_CRM_LEAD_CONVERTED" as const;

export const satelliteCrmLeadConvertedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_LEAD_CONVERTED),
  payload: z.object({
    leadId: z.string(),
    counterpartyId: z.string().optional(),
    partyKind: z.enum(["INDIVIDUAL", "LEGAL_ENTITY"]).optional(),
    taxId: z.string().optional(),
    companyName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
    globalPersonId: z.string().optional(),
    activitySector: z.string().optional(),
    prospectType: z.enum(["CUSTOMER", "PARTNER", "OTHER"]).optional(),
    channel: z.enum(["whatsapp", "instagram", "visit", "phone", "other"]),
    estimatedAmount: z.number().optional(),
    currency: z.literal("AZN").optional(),
  }),
});

export type SatelliteCrmLeadConvertedEvent = z.infer<
  typeof satelliteCrmLeadConvertedSchema
>;

export function isSatelliteCrmLeadConverted(
  data: unknown,
): data is SatelliteCrmLeadConvertedEvent {
  return satelliteCrmLeadConvertedSchema.safeParse(data).success;
}

export const SATELLITE_CRM_VISIT_LOGGED =
  "SATELLITE_CRM_VISIT_LOGGED" as const;

export const satelliteCrmVisitLoggedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_VISIT_LOGGED),
  payload: z.object({
    visitId: z.string(),
    leadId: z.string(),
    channel: z
      .enum(["whatsapp", "instagram", "visit", "phone", "other"])
      .optional(),
  }),
});

export type SatelliteCrmVisitLoggedEvent = z.infer<
  typeof satelliteCrmVisitLoggedSchema
>;

export function isSatelliteCrmVisitLogged(
  data: unknown,
): data is SatelliteCrmVisitLoggedEvent {
  return satelliteCrmVisitLoggedSchema.safeParse(data).success;
}

export const SATELLITE_CRM_MESSAGE_RECEIVED =
  "SATELLITE_CRM_MESSAGE_RECEIVED" as const;
export const SATELLITE_CRM_MESSAGE_SENT = "SATELLITE_CRM_MESSAGE_SENT" as const;
export const SATELLITE_CRM_CALL_STARTED = "SATELLITE_CRM_CALL_STARTED" as const;
export const SATELLITE_CRM_CALL_ENDED = "SATELLITE_CRM_CALL_ENDED" as const;
export const SATELLITE_CRM_LEAD_CAPTURED =
  "SATELLITE_CRM_LEAD_CAPTURED" as const;

export const satelliteCrmMessageReceivedSchema = satelliteEventBaseSchema.extend(
  {
    type: z.literal(SATELLITE_CRM_MESSAGE_RECEIVED),
    payload: z.object({
      organizationId: z.string(),
      conversationId: z.string(),
      messageId: z.string(),
      leadId: z.string().optional(),
      channel: z.string(),
    }),
  },
);

export const satelliteCrmMessageSentSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_MESSAGE_SENT),
  payload: z.object({
    organizationId: z.string(),
    conversationId: z.string(),
    messageId: z.string(),
    leadId: z.string().optional(),
    channel: z.string(),
  }),
});

export const satelliteCrmCallStartedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_CALL_STARTED),
  payload: z.object({
    organizationId: z.string(),
    callId: z.string(),
    leadId: z.string().optional(),
    fromNumber: z.string().optional(),
  }),
});

export const satelliteCrmCallEndedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_CALL_ENDED),
  payload: z.object({
    organizationId: z.string(),
    callId: z.string(),
    leadId: z.string().optional(),
    status: z.string(),
  }),
});

export const satelliteCrmLeadCapturedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_LEAD_CAPTURED),
  payload: z.object({
    organizationId: z.string(),
    leadId: z.string(),
    source: z.string(),
  }),
});
